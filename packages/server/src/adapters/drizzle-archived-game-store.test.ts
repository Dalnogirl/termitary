import {
  BASE_RULESET,
  type Move,
  PILLBUG_RULESET,
  applyMove,
  createGame,
  replayFrames,
  resign,
} from '@termitary/engine';
import { type WireGameState, toWire } from '@termitary/protocol';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { toArchivedGame } from '../domain/archived-game.js';
import { createPairedRoom, isFinished, touch } from '../domain/room.js';
import { describeArchivedGameStoreContract } from './archived-game-store.contract.js';
import { user } from './db/auth-schema.js';
import { type DbHandle, createDb } from './db/client.js';
import { CURRENT_ARCHIVE_STATE_VERSION, archivedGames } from './db/schema.js';
import { createDrizzleArchivedGameStore } from './drizzle-archived-game-store.js';

const seedUser = (db: DbHandle, id: string): void => {
  db.db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test` })
    .run();
};

const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

const finishedGame = (id: string) => {
  const seated = createPairedRoom(id, { playerId: 'p1' }, { playerId: 'p2' }, new Date(1000));
  const room = touch({ ...seated, state: { ...seated.state, ...FINISHED } }, new Date(2000));
  if (!isFinished(room)) throw new Error('unreachable: the room was just finished');
  return toArchivedGame(
    room,
    new Map([
      ['p1', 'Alice'],
      ['p2', 'Bob'],
    ]),
  );
};

// Black's pillbug throws the white queen, so the archived history carries a
// move kind no other game produces and a stun that only the history remembers.
const PILLBUG_SCRIPT: readonly Move[] = [
  { kind: 'place', piece: { type: 'queen', color: 'white' }, to: { q: 0, r: 0 } },
  { kind: 'place', piece: { type: 'pillbug', color: 'black' }, to: { q: -1, r: 0 } },
  { kind: 'place', piece: { type: 'beetle', color: 'white' }, to: { q: 1, r: -1 } },
  { kind: 'place', piece: { type: 'queen', color: 'black' }, to: { q: -2, r: 1 } },
  { kind: 'relocate', from: { q: 1, r: -1 }, to: { q: 0, r: -1 } },
  { kind: 'throw', by: { q: -1, r: 0 }, from: { q: 0, r: 0 }, to: { q: -1, r: 1 } },
];

const pillbugGame = (id: string) => {
  const seated = createPairedRoom(
    id,
    { playerId: 'p1' },
    { playerId: 'p2' },
    new Date(1000),
    PILLBUG_RULESET,
  );
  const played = PILLBUG_SCRIPT.reduce(applyMove, createGame(PILLBUG_RULESET));
  const room = touch({ ...seated, state: resign(played, 'white') }, new Date(2000));
  if (!isFinished(room)) throw new Error('unreachable: the game was just resigned');
  return toArchivedGame(
    room,
    new Map([
      ['p1', 'Alice'],
      ['p2', 'Bob'],
    ]),
  );
};

describeArchivedGameStoreContract('DrizzleArchivedGameStore', async () => {
  const db = createDb(':memory:');
  return {
    archive: createDrizzleArchivedGameStore(db.db),
    seedUser: async (id) => seedUser(db, id),
    cleanup: () => db.close(),
  };
});

describe('DrizzleArchivedGameStore', () => {
  const withArchive = async (fn: (db: DbHandle) => Promise<void>): Promise<void> => {
    const db = createDb(':memory:');
    try {
      seedUser(db, 'p1');
      seedUser(db, 'p2');
      await fn(db);
    } finally {
      db.close();
    }
  };

  it('stamps the current archive payload version', async () =>
    withArchive(async (db) => {
      await createDrizzleArchivedGameStore(db.db).record(finishedGame('r1'));

      const row = db.db.select().from(archivedGames).where(eq(archivedGames.id, 'r1')).get();
      expect(row?.stateVersion).toBe(CURRENT_ARCHIVE_STATE_VERSION);
    }));

  it('replays a game archived before the state carried a ruleset', async () =>
    withArchive(async (db) => {
      const archive = createDrizzleArchivedGameStore(db.db);
      const game = finishedGame('r1');
      await archive.record(game);
      const { ruleset: _dropped, ...legacy } = toWire(game.state);
      db.db
        .update(archivedGames)
        .set({ state: legacy as WireGameState })
        .where(eq(archivedGames.id, 'r1'))
        .run();

      const stored = await archive.get('r1');
      expect(stored?.state.ruleset).toEqual(BASE_RULESET);
      expect(replayFrames(stored?.state.history ?? [], BASE_RULESET)).toHaveLength(1);
    }));

  it('replays an archived pillbug game to the position it finished in', async () =>
    withArchive(async (db) => {
      const archive = createDrizzleArchivedGameStore(db.db);
      const game = pillbugGame('r1');
      await archive.record(game);

      const stored = await archive.get('r1');
      const replayed = replayFrames(
        stored?.state.history ?? [],
        stored?.state.ruleset ?? BASE_RULESET,
      );

      expect(stored?.state.ruleset).toEqual(PILLBUG_RULESET);
      expect(replayed.at(-1)?.board).toEqual(game.state.board);
    }));

  it('keeps a deleted account out of the seat but keeps the name it played under', async () =>
    withArchive(async (db) => {
      const archive = createDrizzleArchivedGameStore(db.db);
      await archive.record(finishedGame('r1'));

      db.db.delete(user).where(eq(user.id, 'p2')).run();

      expect((await archive.get('r1'))?.players.black).toEqual({
        playerId: undefined,
        name: 'Bob',
      });
    }));

  it('drops a game with a null seat out of that player listing only', async () =>
    withArchive(async (db) => {
      const archive = createDrizzleArchivedGameStore(db.db);
      await archive.record(finishedGame('r1'));

      db.db.delete(user).where(eq(user.id, 'p2')).run();

      expect((await archive.listForPlayer('p1', { limit: 10 })).map((g) => g.id)).toEqual(['r1']);
      expect(await archive.listForPlayer('p2', { limit: 10 })).toEqual([]);
    }));
});
