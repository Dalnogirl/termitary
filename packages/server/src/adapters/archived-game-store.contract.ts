import { describe, expect, it } from 'vitest';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import type { ArchivedGame } from '../domain/archived-game.js';
import { toArchivedGame } from '../domain/archived-game.js';
import { createRoom, isFinished, seatPlayer, touch } from '../domain/room.js';

export type ArchivedGameStoreHarness = {
  readonly archive: ArchivedGameStore;
  /** Seats are a foreign key in persisting stores; the id has to exist. */
  seedUser(id: string): Promise<void>;
  cleanup?(): void;
};

const ident = (id: string) => ({ playerId: id });

const ALL = { limit: 100 };

// Playing to a real queen surround here would say nothing about the archive.
const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

const gameOf = (
  id: string,
  { white = 'p1', black = 'p2', startedAt = 1000, finishedAt = 2000 } = {},
): ArchivedGame => {
  const seated = seatPlayer(createRoom(id, ident(white), new Date(startedAt)), ident(black));
  const room = touch({ ...seated, state: { ...seated.state, ...FINISHED } }, new Date(finishedAt));
  if (!isFinished(room)) throw new Error('unreachable: the room was just finished');
  return toArchivedGame(
    room,
    new Map([
      [white, `${white} name`],
      [black, `${black} name`],
    ]),
  );
};

// Anything asserted here belongs to the port, not to an implementation.
export const describeArchivedGameStoreContract = (
  name: string,
  createHarness: () => Promise<ArchivedGameStoreHarness>,
): void => {
  describe(`${name} (ArchivedGameStore contract)`, () => {
    const withArchive = async (
      fn: (h: ArchivedGameStoreHarness) => Promise<void>,
    ): Promise<void> => {
      const harness = await createHarness();
      try {
        await harness.seedUser('p1');
        await harness.seedUser('p2');
        await harness.seedUser('p3');
        await fn(harness);
      } finally {
        harness.cleanup?.();
      }
    };

    it('record + get round-trips, history included', async () =>
      withArchive(async ({ archive }) => {
        const game = gameOf('r1');
        await archive.record(game);

        const stored = await archive.get('r1');
        expect(stored).toEqual(game);
        expect(stored?.state.history).toEqual(game.state.history);
      }));

    it('get on a game never recorded returns undefined', async () =>
      withArchive(async ({ archive }) => {
        expect(await archive.get('nope')).toBeUndefined();
      }));

    it('recording the same game twice leaves the first row alone', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('r1', { finishedAt: 2000 }));
        await archive.record(gameOf('r1', { black: 'p3', finishedAt: 9000 }));

        const stored = await archive.get('r1');
        expect(stored?.finishedAt).toEqual(new Date(2000));
        expect(stored?.players.black?.playerId).toBe('p2');
      }));

    it('lists a game for either seat', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('r1', { white: 'p1', black: 'p2' }));

        expect((await archive.listForPlayer('p1', ALL)).map((g) => g.id)).toEqual(['r1']);
        expect((await archive.listForPlayer('p2', ALL)).map((g) => g.id)).toEqual(['r1']);
        expect(await archive.listForPlayer('p3', ALL)).toEqual([]);
      }));

    it('lists most recently finished first', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('older', { finishedAt: 2000 }));
        await archive.record(gameOf('newer', { finishedAt: 5000 }));

        expect((await archive.listForPlayer('p1', ALL)).map((g) => g.id)).toEqual([
          'newer',
          'older',
        ]);
      }));

    it('lists the snapshotted names and the game summary', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('r1', { startedAt: 1000, finishedAt: 4000 }));

        expect(await archive.listForPlayer('p1', ALL)).toEqual([
          {
            id: 'r1',
            players: {
              white: { playerId: 'p1', name: 'p1 name' },
              black: { playerId: 'p2', name: 'p2 name' },
            },
            result: 'draw',
            endReason: 'queen-surrounded',
            startedAt: new Date(1000),
            finishedAt: new Date(4000),
            moveCount: 0,
          },
        ]);
      }));

    it('stops at the limit and resumes strictly after the cursor', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('r1', { finishedAt: 1000 }));
        await archive.record(gameOf('r2', { finishedAt: 2000 }));
        await archive.record(gameOf('r3', { finishedAt: 3000 }));

        const first = await archive.listForPlayer('p1', { limit: 2 });
        expect(first.map((g) => g.id)).toEqual(['r3', 'r2']);

        const last = first.at(-1);
        if (last === undefined) throw new Error('unreachable: the page has two rows');
        const next = await archive.listForPlayer('p1', {
          limit: 2,
          before: { finishedAt: last.finishedAt, id: last.id },
        });
        expect(next.map((g) => g.id)).toEqual(['r1']);
      }));

    it('breaks a tie on the id, so a shared finish instant never repeats a row', async () =>
      withArchive(async ({ archive }) => {
        await archive.record(gameOf('a', { finishedAt: 2000 }));
        await archive.record(gameOf('b', { finishedAt: 2000 }));
        await archive.record(gameOf('c', { finishedAt: 2000 }));

        const first = await archive.listForPlayer('p1', { limit: 2 });
        expect(first.map((g) => g.id)).toEqual(['c', 'b']);

        const next = await archive.listForPlayer('p1', {
          limit: 2,
          before: { finishedAt: new Date(2000), id: 'b' },
        });
        expect(next.map((g) => g.id)).toEqual(['a']);
      }));

    it('keeps the name of a seat whose account is gone', async () =>
      withArchive(async ({ archive }) => {
        const game = gameOf('r1');
        await archive.record({
          ...game,
          players: { ...game.players, black: { playerId: undefined, name: 'p2 name' } },
        });

        expect((await archive.get('r1'))?.players.black).toEqual({
          playerId: undefined,
          name: 'p2 name',
        });
      }));

    it('keeps a seat nobody held as empty', async () =>
      withArchive(async ({ archive }) => {
        const game = gameOf('r1');
        await archive.record({ ...game, players: { ...game.players, black: undefined } });

        expect((await archive.get('r1'))?.players.black).toBeUndefined();
      }));
  });
};
