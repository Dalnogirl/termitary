import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { toArchivedGame } from '../domain/archived-game.js';
import { createRoom, isFinished, seatPlayer, touch } from '../domain/room.js';
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
  const seated = seatPlayer(createRoom(id, { playerId: 'p1' }, 'white', new Date(1000)), {
    playerId: 'p2',
  });
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
