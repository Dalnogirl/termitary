import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_RULESET, replayFrames } from '@termitary/engine';
import { BEFORE_SQUEEZE, SQUEEZE } from '@termitary/engine/testing';
import { type WireGameState, toWire } from '@termitary/protocol';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { RoomStore } from '../domain/room-store.js';
import { UNTIMED, createPairedRoom, play, touch } from '../domain/room.js';
import { user } from './db/auth-schema.js';
import { type DbHandle, createDb } from './db/client.js';
import { CURRENT_STATE_VERSION, rooms as roomsTable } from './db/schema.js';
import { createDrizzleArchivedGameStore } from './drizzle-archived-game-store.js';
import { createDrizzleRoomStore } from './drizzle-room-store.js';
import { createDrizzleUnitOfWork } from './drizzle-unit-of-work.js';
import { describeRoomStoreContract } from './room-store.contract.js';

const seedUser = (db: DbHandle, id: string): void => {
  db.db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` })
    .run();
};

const ANT_AT_ORIGIN = {
  kind: 'place',
  piece: { type: 'ant', color: 'white' },
  to: { q: 0, r: 0 },
} as const;

const antPlaced = () =>
  play(
    createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
    'white',
    ANT_AT_ORIGIN,
    new Date(2000),
  );

describeRoomStoreContract('DrizzleRoomStore', async () => {
  const db = createDb(':memory:');
  return {
    store: createDrizzleRoomStore(db.db),
    archive: createDrizzleArchivedGameStore(db.db),
    unitOfWork: createDrizzleUnitOfWork(db.db),
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
      const room = antPlaced();
      await store.create(room);

      const stored = await store.get('r1');
      expect(stored).toEqual(room);
      // toWire flattens the board Map to an object, so this asserts it came back.
      expect(stored?.state.board.cells.get('0,0')).toEqual([{ type: 'ant', color: 'white' }]);
      expect(stored?.state.history).toHaveLength(1);
    }));

  it('mirrors state.status into its own column', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      expect(rowOf(db, 'r1')?.status).toBe('in_progress');
    }));

  it('increments version on every save and leaves created_at alone', async () =>
    withStore(async ({ db, store }) => {
      const room = createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000));
      await store.create(room);
      expect(rowOf(db, 'r1')?.version).toBe(1);

      const played = touch(room, new Date(2000));
      await store.save(played, 1);
      await store.save(played, 2);

      const row = rowOf(db, 'r1');
      expect(row?.version).toBe(3);
      expect(row?.createdAt).toEqual(new Date(1000));
      expect(row?.updatedAt).toEqual(new Date(2000));
    }));

  it('stamps the current state payload version', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      expect(rowOf(db, 'r1')?.stateVersion).toBe(CURRENT_STATE_VERSION);
    }));

  it('plays the pass a room stored before auto-pass was still waiting on', async () =>
    withStore(async ({ db, store }) => {
      const stuck = replayFrames([...BEFORE_SQUEEZE, SQUEEZE], BASE_RULESET).at(-1);
      if (stuck === undefined) throw new Error('no frames');
      await store.create({
        ...createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
        state: stuck,
      });
      // A version 2 row predates the clock column too.
      db.db
        .update(roomsTable)
        .set({ stateVersion: 2, clock: null })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      const stored = await store.get('r1');
      expect(stored?.state.history.at(-1)).toEqual({ kind: 'pass' });
      expect(stored?.state.currentPlayer).toBe('black');
      expect(stored?.clock.toMove).toBe('black');
    }));

  it('reads a stored room where neither side can move, as stored', async () =>
    withStore(async ({ db, store }) => {
      const room = createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000));
      await store.create(room);
      const deadlock = toWire({
        ...room.state,
        board: {
          cells: new Map([
            ['0,0', [{ type: 'queen', color: 'white' }]],
            ['5,0', [{ type: 'queen', color: 'black' }]],
          ]),
        },
        hands: { white: {}, black: {} },
        turnNumbers: { white: 11, black: 11 },
      });
      db.db
        .update(roomsTable)
        .set({ state: deadlock, stateVersion: 2 })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      expect((await store.get('r1'))?.state.history).toEqual([]);
    }));

  it('reads a null ruleset column as base', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      // What a row written before the column looks like.
      db.db.update(roomsTable).set({ ruleset: null }).where(eq(roomsTable.id, 'r1')).run();

      expect((await store.get('r1'))?.ruleset).toEqual(BASE_RULESET);
    }));

  it('replays a state stored before it carried a ruleset', async () =>
    withStore(async ({ db, store }) => {
      const room = antPlaced();
      await store.create(room);
      const { ruleset: _dropped, ...legacy } = toWire(room.state);
      db.db
        .update(roomsTable)
        .set({ state: legacy as WireGameState, ruleset: null })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      const stored = await store.get('r1');
      expect(stored?.state.ruleset).toEqual(BASE_RULESET);
      expect(replayFrames(stored?.state.history ?? [], BASE_RULESET).at(-1)?.board.cells).toEqual(
        stored?.state.board.cells,
      );
    }));

  it('lists a room whose ruleset cannot be parsed, as base', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      db.db
        .update(roomsTable)
        .set({ ruleset: { pieces: { queen: 'lots' } } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      const [listed] = await store.listSeatedBy('p1');
      expect(listed?.ruleset).toEqual(BASE_RULESET);
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('reads a null clock column as untimed, with the game side to move', async () =>
    withStore(async ({ db, store }) => {
      await store.create(antPlaced());
      // What a row written before the column looks like.
      db.db.update(roomsTable).set({ clock: null }).where(eq(roomsTable.id, 'r1')).run();

      const stored = await store.get('r1');
      expect(stored?.clock.kind).toBe('untimed');
      expect(stored?.clock.toMove).toBe('black');
      const [listed] = await store.listSeatedBy('p1');
      expect(listed?.timeControl).toEqual(UNTIMED);
    }));

  it('lists a room whose clock cannot be parsed, as untimed', async () =>
    withStore(async ({ db, store }) => {
      await store.create(antPlaced());
      db.db
        .update(roomsTable)
        .set({ clock: { kind: 'sundial' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      const [listed] = await store.listSeatedBy('p1');
      expect(listed?.timeControl).toEqual(UNTIMED);
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('rejects a clock that disagrees with the game on whose turn it is', async () =>
    withStore(async ({ store }) => {
      const room = antPlaced();
      await store.create({ ...room, clock: { ...room.clock, toMove: 'white' } });
      await expect(store.get('r1')).rejects.toThrow(/whose turn/);
    }));

  it('rejects a state payload it cannot parse', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      db.db
        .update(roomsTable)
        .set({ state: { status: 'in_progress' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('lists a room whose state cannot be parsed', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );
      await store.create(
        createPairedRoom('r2', { playerId: 'p2' }, { playerId: 'p1' }, new Date(1000)),
      );
      db.db
        .update(roomsTable)
        .set({ state: { status: 'in_progress' } as never })
        .where(eq(roomsTable.id, 'r1'))
        .run();

      // The listing projects columns and never touches `state`, so one bad row
      // does not fail it.
      const listed = await store.listSeatedBy('p1');
      expect(listed.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
      await expect(store.get('r1')).rejects.toThrow();
    }));

  it('refuses to delete an account seated in a room', async () =>
    withStore(async ({ db, store }) => {
      await store.create(
        createPairedRoom('r1', { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000)),
      );

      expect(() => db.db.delete(user).where(eq(user.id, 'p2')).run()).toThrow(/FOREIGN KEY/);

      const stored = await store.get('r1');
      expect(stored?.players).toEqual({ white: { playerId: 'p1' }, black: { playerId: 'p2' } });
    }));

  it('survives closing and reopening the database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'termitary-room-store-'));
    try {
      const path = join(dir, 'test.db');
      const room = antPlaced();

      const first = createDb(path);
      try {
        seedUser(first, 'p1');
        seedUser(first, 'p2');
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
