import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_RULESET, applyMove, createGame } from '@termitary/engine';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { RoomStore } from '../domain/room-store.js';
import { createRoom, touch } from '../domain/room.js';
import { user } from './db/auth-schema.js';
import { type DbHandle, createDb } from './db/client.js';
import { CURRENT_STATE_VERSION, rooms as roomsTable } from './db/schema.js';
import { createDrizzleRoomStore } from './drizzle-room-store.js';
import { describeRoomStoreContract } from './room-store.contract.js';

const seedUser = (db: DbHandle, id: string): void => {
  db.db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` })
    .run();
};

const placeAnt = (q: number, r: number) =>
  applyMove(createGame(), {
    kind: 'place',
    piece: { type: 'ant', color: 'white' },
    to: { q, r },
  });

describeRoomStoreContract('DrizzleRoomStore', async () => {
  const db = createDb(':memory:');
  return {
    store: createDrizzleRoomStore(db.db),
    seedUser: async (id) => seedUser(db, id),
    cleanup: () => db.close(),
  };
});

describe('DrizzleRoomStore', () => {
  const withStore = async (
    fn: (ctx: { db: DbHandle; store: RoomStore }) => Promise<void>,
  ): Promise<void> => {
    const db = createDb(':memory:');
    try {
      seedUser(db, 'p1');
      seedUser(db, 'p2');
      await fn({ db, store: createDrizzleRoomStore(db.db) });
    } finally {
      db.close();
    }
  };

  const rowOf = (db: DbHandle, id: string) =>
    db.db.select().from(roomsTable).where(eq(roomsTable.id, id)).get();

  it('round-trips a played game, board and history included', async () =>
    withStore(async ({ store }) => {
      const room = {
        ...createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)),
        state: placeAnt(0, 0),
      };
      await store.create(room);

      const stored = await store.get('r1');
      expect(stored).toEqual(room);
      // toWire flattens the board Map to an object, so this asserts it came back.
      expect(stored?.state.board.cells.get('0,0')).toEqual([{ type: 'ant', color: 'white' }]);
      expect(stored?.state.history).toHaveLength(1);
    }));

  it('mirrors state.status into its own column', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)));
      expect(rowOf(db, 'r1')?.status).toBe('in_progress');
    }));

  it('increments version on every save and leaves created_at alone', async () =>
    withStore(async ({ db, store }) => {
      const room = createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000));
      await store.create(room);
      expect(rowOf(db, 'r1')?.version).toBe(1);

      const played = touch(room, new Date(2000));
      await store.save(played);
      await store.save(played);

      const row = rowOf(db, 'r1');
      expect(row?.version).toBe(3);
      expect(row?.createdAt).toEqual(new Date(1000));
      expect(row?.updatedAt).toEqual(new Date(2000));
    }));

  it('stamps the current state payload version', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)));
      expect(rowOf(db, 'r1')?.stateVersion).toBe(CURRENT_STATE_VERSION);
    }));

  it('reads a null ruleset column as base', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)));
      // What a row written before the column looks like.
      db.db.update(roomsTable).set({ ruleset: null }).where(eq(roomsTable.id, 'r1')).run();

      expect((await store.get('r1'))?.ruleset).toEqual(BASE_RULESET);
    }));

  it('rejects a state payload it cannot parse', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)));
      db.db
        .update(roomsTable)
        .set({ state: { status: 'in_progress' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('lists a room whose state cannot be parsed', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)));
      await store.create(createRoom('r2', { playerId: 'p2' }, 'white', new Date(1000)));
      db.db
        .update(roomsTable)
        .set({ state: { status: 'in_progress' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      // The lobby projects columns and never touches `state`, so one bad row
      // does not fail the listing for every user.
      const listed = await store.listOpenExcluding('nobody');
      expect(listed.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('unseats a player when their account is deleted', async () =>
    withStore(async ({ db, store }) => {
      await store.create({
        ...createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)),
        players: { white: { playerId: 'p1' }, black: { playerId: 'p2' } },
      });

      db.db.delete(user).where(eq(user.id, 'p2')).run();

      const stored = await store.get('r1');
      expect(stored?.players).toEqual({ white: { playerId: 'p1' }, black: undefined });
    }));

  it('survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'termitary-room-store-'));
    try {
      const path = join(dir, 'test.db');
      const room = {
        ...createRoom('r1', { playerId: 'p1' }, 'white', new Date(1000)),
        state: placeAnt(0, 0),
      };

      const first = createDb(path);
      try {
        seedUser(first, 'p1');
        await createDrizzleRoomStore(first.db).create(room);
      } finally {
        first.close();
      }

      const second = createDb(path);
      try {
        expect(await createDrizzleRoomStore(second.db).get('r1')).toEqual(room);
      } finally {
        second.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
