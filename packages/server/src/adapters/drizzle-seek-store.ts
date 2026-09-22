import { SeekPreferenceSchema } from '@termitary/protocol';
import { and, asc, desc, eq, gt, lte, ne } from 'drizzle-orm';
import { SeekAlreadyExistsError, type SeekStore } from '../domain/seek-store.js';
import type { Seek } from '../domain/seek.js';
import type { Db } from './db/client.js';
import { type SeekRow, seeks as seeksTable } from './db/schema.js';

const toSeek = (row: SeekRow): Seek => ({
  id: row.id,
  seeker: { playerId: row.seekerUserId },
  preference: SeekPreferenceSchema.parse(row.preference),
  visibility: row.visibility,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
});

// A preference nothing can parse is a seek nothing can safely pair, and
// rebuilding it as the default would pair someone under terms they never
// picked. So an unreadable row is treated as absent everywhere: invisible to
// its owner, uncountable against their cap, and unclaimable. It leaves at
// expiry, or the moment a claim deletes it.
const tryToSeek = (row: SeekRow): Seek | undefined => {
  try {
    return toSeek(row);
  } catch {
    return undefined;
  }
};

const readable = (rows: readonly SeekRow[]): readonly Seek[] =>
  rows.flatMap((row) => tryToSeek(row) ?? []);

const isPrimaryKeyViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';

export const createDrizzleSeekStore = (db: Db): SeekStore => ({
  create: async (seek) => {
    try {
      db.insert(seeksTable)
        .values({
          id: seek.id,
          seekerUserId: seek.seeker.playerId,
          preference: seek.preference,
          visibility: seek.visibility,
          createdAt: seek.createdAt,
          expiresAt: seek.expiresAt,
        })
        .run();
    } catch (err) {
      if (isPrimaryKeyViolation(err)) throw new SeekAlreadyExistsError(seek.id);
      throw err;
    }
  },

  get: async (id) => {
    const row = db.select().from(seeksTable).where(eq(seeksTable.id, id)).get();
    return row === undefined ? undefined : tryToSeek(row);
  },

  listPool: async (excluding, now) =>
    readable(
      db
        .select()
        .from(seeksTable)
        .where(
          and(
            eq(seeksTable.visibility, 'pool'),
            gt(seeksTable.expiresAt, now),
            ne(seeksTable.seekerUserId, excluding),
          ),
        )
        .orderBy(asc(seeksTable.createdAt))
        .all(),
    ),

  listFor: async (playerId, now) =>
    readable(
      db
        .select()
        .from(seeksTable)
        .where(and(eq(seeksTable.seekerUserId, playerId), gt(seeksTable.expiresAt, now)))
        .orderBy(desc(seeksTable.createdAt))
        .all(),
    ),

  // Over the readable rows, not a SQL count: charging a player for a seek they
  // cannot see or cancel would lock them out of posting for the whole TTL.
  countFor: async (playerId, now) =>
    readable(
      db
        .select()
        .from(seeksTable)
        .where(and(eq(seeksTable.seekerUserId, playerId), gt(seeksTable.expiresAt, now)))
        .all(),
    ).length,

  // The delete runs either way, so a claim on an unreadable row clears it
  // rather than leaving it to the sweep. The caller sees the same "gone" it
  // would see after losing the race.
  claim: async (id) => {
    const row = db.delete(seeksTable).where(eq(seeksTable.id, id)).returning().get();
    return row === undefined ? undefined : tryToSeek(row);
  },

  deleteExpiredBefore: async (now) =>
    db.delete(seeksTable).where(lte(seeksTable.expiresAt, now)).run().changes,
});
