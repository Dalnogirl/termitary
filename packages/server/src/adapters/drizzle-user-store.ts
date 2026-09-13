import { eq, inArray } from 'drizzle-orm';
import { generateProfileName } from '../domain/profile-name.js';
import type { Profile, UserStore } from '../domain/user-store.js';
import { user } from './db/auth-schema.js';
import type { Db } from './db/client.js';
import { type ProfileRow, profiles } from './db/schema.js';

const toProfile = (row: ProfileRow): Profile => ({
  userId: row.userId,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const readProfile = (db: Db, userId: string): ProfileRow | undefined =>
  db.select().from(profiles).where(eq(profiles.userId, userId)).get();

/**
 * Read first: this runs on every sign-in and almost always finds a row, and a
 * write would serialize the whole sqlite database to discover that. The insert
 * still absorbs a conflict, for two sign-ins racing on a brand new account.
 */
const ensureProfileRow = (db: Db, userId: string, now: Date): ProfileRow => {
  const existing = readProfile(db, userId);
  if (existing !== undefined) return existing;

  db.insert(profiles)
    .values({ userId, name: generateProfileName(), createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .run();
  const row = readProfile(db, userId);
  if (row === undefined) throw new Error(`no profile for user ${userId} after insert`);
  return row;
};

export const createDrizzleUserStore = (db: Db): UserStore => ({
  namesOf: async (ids) => {
    if (ids.length === 0) return new Map();
    const rows = db
      .select({ id: profiles.userId, name: profiles.name })
      .from(profiles)
      .where(inArray(profiles.userId, [...ids]))
      .all();
    return new Map(rows.map((row) => [row.id, row.name]));
  },

  get: async (userId) => {
    const row = readProfile(db, userId);
    return row === undefined ? null : toProfile(row);
  },

  ensure: async (userId, now) => toProfile(ensureProfileRow(db, userId, now)),

  rename: async (userId, name, now) => {
    // The profile FK cascades, so an account deleted mid-flight leaves no row
    // to update and the insert half of `ensureProfileRow` would violate it.
    const accountExists = db.select({ id: user.id }).from(user).where(eq(user.id, userId)).get();
    if (accountExists === undefined) return null;
    ensureProfileRow(db, userId, now);
    const row = db
      .update(profiles)
      .set({ name, updatedAt: now })
      .where(eq(profiles.userId, userId))
      .returning()
      .get();
    return toProfile(row);
  },
});
