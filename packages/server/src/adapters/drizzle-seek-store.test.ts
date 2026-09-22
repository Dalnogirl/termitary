import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { SeekAlreadyExistsError } from '../domain/seek-store.js';
import { createSeek } from '../domain/seek.js';
import { user } from './db/auth-schema.js';
import { type DbHandle, createDb } from './db/client.js';
import { seeks as seeksTable } from './db/schema.js';
import { createDrizzleSeekStore } from './drizzle-seek-store.js';
import { describeSeekStoreContract } from './seek-store.contract.js';

const seedUser = (db: DbHandle, id: string): void => {
  db.db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` })
    .run();
};

describeSeekStoreContract('DrizzleSeekStore', async () => {
  const db = createDb(':memory:');
  return {
    store: createDrizzleSeekStore(db.db),
    seedUser: async (id) => seedUser(db, id),
    cleanup: () => db.close(),
  };
});

describe('DrizzleSeekStore', () => {
  const withStore = async (
    fn: (ctx: { db: DbHandle; store: ReturnType<typeof createDrizzleSeekStore> }) => Promise<void>,
  ): Promise<void> => {
    const db = createDb(':memory:');
    try {
      seedUser(db, 'p1');
      seedUser(db, 'p2');
      await fn({ db, store: createDrizzleSeekStore(db.db) });
    } finally {
      db.close();
    }
  };

  const seek = (id: string, owner: string) =>
    createSeek(id, { playerId: owner }, {}, 'pool', new Date(1000));

  it('rejects a duplicate id', async () =>
    withStore(async ({ store }) => {
      await store.create(seek('s1', 'p1'));
      await expect(store.create(seek('s1', 'p1'))).rejects.toThrow(SeekAlreadyExistsError);
    }));

  it('takes a seek with its seeker when the account is deleted', async () =>
    withStore(async ({ db, store }) => {
      await store.create(seek('s1', 'p1'));
      db.db.delete(user).where(eq(user.id, 'p1')).run();

      expect(await store.get('s1')).toBeUndefined();
    }));

  // A rollback to a server that predates an expansion is what writes one of
  // these: the schema is strict, so it has no tolerance for a newer choice.
  const breakPreference = (db: DbHandle, id: string): void => {
    db.db
      .update(seeksTable)
      .set({ preference: { ladybug: 'maybe' } as never })
      .where(eq(seeksTable.id, id))
      .run();
  };

  it('treats a seek whose preference cannot be parsed as absent', async () =>
    withStore(async ({ db, store }) => {
      await store.create(seek('broken', 'p1'));
      await store.create(seek('fine', 'p2'));
      breakPreference(db, 'broken');

      // Rebuilding it as the default would pair someone under terms they
      // never picked, so it is unpairable and hidden rather than repaired.
      expect((await store.listPool('nobody', new Date(2000))).map((s) => s.id)).toEqual(['fine']);
      expect(await store.get('broken')).toBeUndefined();
      expect(await store.listFor('p1', new Date(2000))).toEqual([]);
    }));

  it('does not charge a player for a seek they cannot see or cancel', async () =>
    withStore(async ({ db, store }) => {
      await store.create(seek('broken', 'p1'));
      breakPreference(db, 'broken');

      expect(await store.countFor('p1', new Date(2000))).toBe(0);
    }));

  it('clears an unreadable seek on a claim rather than leaving it to the sweep', async () =>
    withStore(async ({ db, store }) => {
      await store.create(seek('broken', 'p1'));
      breakPreference(db, 'broken');

      expect(await store.claim('broken')).toBeUndefined();
      expect(
        db.db.select().from(seeksTable).where(eq(seeksTable.id, 'broken')).get(),
      ).toBeUndefined();
    }));
});
