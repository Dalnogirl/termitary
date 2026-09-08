import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMove, createGame } from '@hive/engine';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
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

describeRoomStoreContract('DrizzleRoomStore', async () => {
  const db = createDb(':memory:');
  return {
    store: createDrizzleRoomStore(db.db),
    seedUser: async (id) => seedUser(db, id),
    cleanup: () => db.close(),
  };
});

describe('DrizzleRoomStore', () => {
  const setup = (now?: () => Date) => {
    const db = createDb(':memory:');
    seedUser(db, 'p1');
    seedUser(db, 'p2');
    return { db, store: createDrizzleRoomStore(db.db, now) };
  };

  const rowOf = (db: DbHandle, id: string) =>
    db.db.select().from(roomsTable).where(eq(roomsTable.id, id)).get();

  it('round-trips a played game, board and history included', async () => {
    const { db, store } = setup();
    const played = applyMove(createGame(), {
      kind: 'place',
      piece: { type: 'ant', color: 'white' },
      to: { q: 0, r: 0 },
    });
    const room = { ...createRoom('r1', { playerId: 'p1' }), state: played };
    await store.create(room);

    const stored = await store.get('r1');
    expect(stored).toEqual(room);
    // toWire flattens the board Map to an object, so this asserts it came back.
    expect(stored?.state.board.cells.get('0,0')).toEqual([{ type: 'ant', color: 'white' }]);
    expect(stored?.state.history).toHaveLength(1);
    db.close();
  });

  it('mirrors state.status into its own column', async () => {
    const { db, store } = setup();
    await store.create(createRoom('r1', { playerId: 'p1' }));
    expect(rowOf(db, 'r1')?.status).toBe('in_progress');
    db.close();
  });

  it('increments version on every save and leaves created_at alone', async () => {
    let clock = new Date(1000);
    const { db, store } = setup(() => clock);
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
    db.close();
  });

  it('stamps the current state payload version', async () => {
    const { db, store } = setup();
    await store.create(createRoom('r1', { playerId: 'p1' }));
    expect(rowOf(db, 'r1')?.stateVersion).toBe(1);
    db.close();
  });

  it('rejects a state payload it cannot parse', async () => {
    const { db, store } = setup();
    await store.create(createRoom('r1', { playerId: 'p1' }));
    db.db
      .update(roomsTable)
      .set({ state: { status: 'in_progress' } as never })
      .where(eq(roomsTable.id, 'r1'))
      .run();
    await expect(store.get('r1')).rejects.toThrow();
    db.close();
  });

  it('unseats a player when their account is deleted', async () => {
    const { db, store } = setup();
    await store.create({
      ...createRoom('r1', { playerId: 'p1' }),
      players: { white: { playerId: 'p1' }, black: { playerId: 'p2' } },
    });

    db.db.delete(user).where(eq(user.id, 'p2')).run();

    const stored = await store.get('r1');
    expect(stored?.players).toEqual({ white: { playerId: 'p1' }, black: undefined });
    db.close();
  });

  it('survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-room-store-'));
    const path = join(dir, 'test.db');

    const first = createDb(path);
    seedUser(first, 'p1');
    const played = applyMove(createGame(), {
      kind: 'place',
      piece: { type: 'ant', color: 'white' },
      to: { q: 0, r: 0 },
    });
    const room = { ...createRoom('r1', { playerId: 'p1' }), state: played };
    await createDrizzleRoomStore(first.db).create(room);
    first.close();

    const second = createDb(path);
    try {
      expect(await createDrizzleRoomStore(second.db).get('r1')).toEqual(room);
    } finally {
      second.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
