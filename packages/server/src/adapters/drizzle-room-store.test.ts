import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMove, createGame } from '@hive/engine';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { RoomStore } from '../domain/room-store.js';
import { createRoom } from '../domain/room.js';
import { user } from './db/auth-schema.js';
import { type DbHandle, createDb } from './db/client.js';
import { rooms as roomsTable } from './db/schema.js';
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
    now?: () => Date,
  ): Promise<void> => {
    const db = createDb(':memory:');
    try {
      seedUser(db, 'p1');
      seedUser(db, 'p2');
      await fn({ db, store: createDrizzleRoomStore(db.db, now) });
    } finally {
      db.close();
    }
  };

  const rowOf = (db: DbHandle, id: string) =>
    db.db.select().from(roomsTable).where(eq(roomsTable.id, id)).get();

  it('round-trips a played game, board and history included', async () =>
    withStore(async ({ store }) => {
      const room = { ...createRoom('r1', { playerId: 'p1' }), state: placeAnt(0, 0) };
      await store.create(room);

      const stored = await store.get('r1');
      expect(stored).toEqual(room);
      // toWire flattens the board Map to an object, so this asserts it came back.
      expect(stored?.state.board.cells.get('0,0')).toEqual([{ type: 'ant', color: 'white' }]);
      expect(stored?.state.history).toHaveLength(1);
    }));

  it('mirrors state.status into its own column', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }));
      expect(rowOf(db, 'r1')?.status).toBe('in_progress');
    }));

  it('increments version on every save and leaves created_at alone', async () => {
    let clock = new Date(1000);
    await withStore(
      async ({ db, store }) => {
        const room = createRoom('r1', { playerId: 'p1' });
        await store.create(room);
        expect(rowOf(db, 'r1')?.version).toBe(1);

        clock = new Date(2000);
        await store.save(room);
        await store.save(room);

        const row = rowOf(db, 'r1');
        expect(row?.version).toBe(3);
        expect(row?.createdAt).toEqual(new Date(1000));
        expect(row?.updatedAt).toEqual(new Date(2000));
      },
      () => clock,
    );
  });

  it('stamps the current state payload version', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }));
      expect(rowOf(db, 'r1')?.stateVersion).toBe(1);
    }));

  it('rejects a state payload it cannot parse', async () =>
    withStore(async ({ db, store }) => {
      await store.create(createRoom('r1', { playerId: 'p1' }));
      db.db
        .update(roomsTable)
        .set({ state: { status: 'in_progress' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('unseats a player when their account is deleted', async () =>
    withStore(async ({ db, store }) => {
      await store.create({
        ...createRoom('r1', { playerId: 'p1' }),
        players: { white: { playerId: 'p1' }, black: { playerId: 'p2' } },
      });

      db.db.delete(user).where(eq(user.id, 'p2')).run();

      const stored = await store.get('r1');
      expect(stored?.players).toEqual({ white: { playerId: 'p1' }, black: undefined });
    }));

  it('survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-room-store-'));
    try {
      const path = join(dir, 'test.db');
      const room = { ...createRoom('r1', { playerId: 'p1' }), state: placeAnt(0, 0) };

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
