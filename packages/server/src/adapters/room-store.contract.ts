import type { TimeControl } from '@termitary/clock';
import { BASE_RULESET, type Ruleset, listValidMoves } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import { toArchivedGame } from '../domain/archived-game.js';
import {
  ConcurrentModificationError,
  RoomAlreadyExistsError,
  type RoomStore,
} from '../domain/room-store.js';
import {
  type FinishedRoom,
  type Room,
  UNTIMED,
  createPairedRoom,
  isFinished,
  play,
  touch,
} from '../domain/room.js';
import type { UnitOfWork } from '../domain/unit-of-work.js';

export type StoreHarness = {
  readonly store: RoomStore;
  /** A finished game's delete commits with its archive row, so both come along. */
  readonly archive: ArchivedGameStore;
  readonly unitOfWork: UnitOfWork;
  /** Seats are a foreign key in persisting stores; the id has to exist. */
  seedUser(id: string): Promise<void>;
  cleanup?(): void;
};

const ident = (id: string) => ({ playerId: id });

// Every save is a compare-and-swap, so a case that only cares about what the
// write stores reads the current version rather than tracking one.
const saveFresh = async (store: RoomStore, room: Room): Promise<void> => {
  const current = await store.getForUpdate(room.id);
  if (current === undefined) throw new Error(`no room ${room.id} to save`);
  await store.save(room, current.version);
};
const at = (ms: number) => new Date(ms);

// Rooms carry their own timestamps, so a store that stamped its own clock
// would fail every ordering case below.
const roomAt = (id: string, white: string, black: string, ms: number, ruleset?: Ruleset) =>
  createPairedRoom(id, ident(white), ident(black), at(ms), ruleset);

// One piece short of base, so a store that quietly rebuilt a base game passes
// nothing below.
const NO_SPIDERS: Ruleset = { pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } };

const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };

const timedRoomAt = (id: string, ms: number) =>
  createPairedRoom(id, ident('p1'), ident('p2'), at(ms), BASE_RULESET, BLITZ);

const playFirstMove = (room: Room, now: Date): Room => {
  if (room.state.status === 'finished') throw new Error('game is over');
  const move = listValidMoves(room.state)[0];
  if (move === undefined) throw new Error('no legal move');
  return play(room, room.state.currentPlayer, move, now);
};

// Both first moves played, so the banks are running and the log has entries.
const playedTwice = (room: Room, ms: number): Room =>
  playFirstMove(playFirstMove(room, at(ms)), at(ms + 1000));

// Playing to a real queen surround here would say nothing about the store.
const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

const finished = (room: Room): FinishedRoom => {
  const done = { ...room, state: { ...room.state, ...FINISHED } };
  if (!isFinished(done)) throw new Error('unreachable');
  return done;
};

// Anything asserted here belongs to the port, not to an implementation.
export const describeRoomStoreContract = (
  name: string,
  createHarness: () => Promise<StoreHarness>,
): void => {
  describe(`${name} (RoomStore contract)`, () => {
    const withStore = async (fn: (h: StoreHarness) => Promise<void>): Promise<void> => {
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

    it('create + get round-trips', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        expect(await store.get('r1')).toEqual(room);
      }));

    it('create + get preserves a non-base ruleset', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000, NO_SPIDERS);
        await store.create(room);

        // Only the room's own ruleset: the hand inside `state` still goes over
        // the wire as five fixed keys, and stays base until S-6.4.
        expect((await store.get('r1'))?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('a listing carries each room ruleset, so the lobby can badge it', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000, NO_SPIDERS));
        const [listed] = await store.listSeatedBy('p1');
        expect(listed?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('save preserves the ruleset', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000, NO_SPIDERS);
        await store.create(room);

        await saveFresh(store, touch(room, at(2000)));

        expect((await store.get('r1'))?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('a room created without a ruleset is base', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        expect((await store.get('r1'))?.ruleset).toEqual(BASE_RULESET);
      }));

    it('create + get round-trips a timed room', async () =>
      withStore(async ({ store }) => {
        const room = timedRoomAt('r1', 1000);
        await store.create(room);
        expect(await store.get('r1')).toEqual(room);
      }));

    it('create + get round-trips a correspondence room', async () =>
      withStore(async ({ store }) => {
        const room = createPairedRoom('r1', ident('p1'), ident('p2'), at(1000), BASE_RULESET, {
          kind: 'correspondence',
          daysPerMove: 3,
        });
        await store.create(playedTwice(room, 2000));
        expect(await store.get('r1')).toEqual(playedTwice(room, 2000));
      }));

    it('save stores the clock a move charged', async () =>
      withStore(async ({ store }) => {
        const room = timedRoomAt('r1', 1000);
        await store.create(room);

        const played = playedTwice(room, 2000);
        await saveFresh(store, played);

        expect((await store.get('r1'))?.clock).toEqual(played.clock);
      }));

    it('a listing carries each room time control', async () =>
      withStore(async ({ store }) => {
        await store.create(timedRoomAt('r1', 1000));
        const [listed] = await store.listSeatedBy('p1');
        expect(listed?.timeControl).toEqual(BLITZ);
      }));

    // Created at 1s, so white's first-move window closes at 31s.
    it('listOverdue finds a timed room once its deadline passes, and not before', async () =>
      withStore(async ({ store }) => {
        await store.create(timedRoomAt('r1', 1000));
        expect(await store.listOverdue(at(30_999))).toEqual([]);
        expect(await store.listOverdue(at(31_000))).toEqual(['r1']);
      }));

    // Both first moves by 3s start white's five-minute bank: due at 303s.
    it('listOverdue follows the deadline a save moved', async () =>
      withStore(async ({ store }) => {
        const room = timedRoomAt('r1', 1000);
        await store.create(room);
        await saveFresh(store, playedTwice(room, 2000));
        expect(await store.listOverdue(at(302_999))).toEqual([]);
        expect(await store.listOverdue(at(303_000))).toEqual(['r1']);
      }));

    it('listOverdue never finds an untimed room', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        expect(await store.listOverdue(at(10 ** 12))).toEqual([]);
      }));

    it('create rejects duplicate ids', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        await expect(store.create(roomAt('r1', 'p2', 'p3', 1000))).rejects.toBeInstanceOf(
          RoomAlreadyExistsError,
        );
      }));

    it('save overwrites existing rooms', async () =>
      withStore(async ({ store }) => {
        const original = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(original);
        const updated = touch({ ...original, state: { ...original.state, ...FINISHED } }, at(2000));
        await saveFresh(store, updated);
        expect(await store.get('r1')).toEqual(updated);
      }));

    it('a committed deleteOp removes the room', async () =>
      withStore(async ({ store, unitOfWork }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');

        await unitOfWork.commit([store.deleteOp('r1', read.version)]);

        expect(await store.get('r1')).toBeUndefined();
      }));

    it('a deleteOp at a stale version is a conflict and deletes nothing', async () =>
      withStore(async ({ store, unitOfWork }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');
        await store.save(touch(room, at(2000)), read.version);

        await expect(
          unitOfWork.commit([store.deleteOp('r1', read.version)]),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);
        expect(await store.get('r1')).toBeDefined();
      }));

    it('a deleteOp on a missing room is a conflict', async () =>
      withStore(async ({ store, unitOfWork }) => {
        await expect(unitOfWork.commit([store.deleteOp('nope', 1)])).rejects.toBeInstanceOf(
          ConcurrentModificationError,
        );
      }));

    it('archives a finished game and deletes its room in one commit', async () =>
      withStore(async ({ store, archive, unitOfWork }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');
        const game = toArchivedGame(finished(touch(room, at(2000))), new Map());

        await unitOfWork.commit([store.deleteOp('r1', read.version), archive.recordOp(game)]);

        expect(await store.get('r1')).toBeUndefined();
        expect(await archive.get('r1')).toEqual(game);
      }));

    it('a failing archive insert leaves the room at its previous state and version', async () =>
      withStore(async ({ store, archive, unitOfWork }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');
        // A seat nobody seeded: the archive's foreign key refuses the row.
        const unrecordable = toArchivedGame(
          finished({ ...room, players: { ...room.players, white: ident('ghost') } }),
          new Map(),
        );

        await expect(
          unitOfWork.commit([store.deleteOp('r1', read.version), archive.recordOp(unrecordable)]),
        ).rejects.toThrow();

        expect(await store.getForUpdate('r1')).toEqual(read);
        expect(await archive.get('r1')).toBeUndefined();
      }));

    it('listSeatedBy returns an overview per room the player sits in', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        await store.create(roomAt('r2', 'p2', 'p1', 1000));
        await store.create(roomAt('r3', 'p2', 'p3', 1000));

        const mine = [...(await store.listSeatedBy('p1'))].sort((a, b) => a.id.localeCompare(b.id));
        expect(mine).toEqual([
          {
            id: 'r1',
            players: { white: ident('p1'), black: ident('p2') },
            status: 'in_progress',
            updatedAt: new Date(1000),
            ruleset: BASE_RULESET,
            timeControl: UNTIMED,
          },
          {
            id: 'r2',
            players: { white: ident('p2'), black: ident('p1') },
            status: 'in_progress',
            updatedAt: new Date(1000),
            ruleset: BASE_RULESET,
            timeControl: UNTIMED,
          },
        ]);
      }));

    it('listSeatedBy finds a player in either seat', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 'p2', 1000));
        await store.create(roomAt('r2', 'p3', 'p1', 1000));
        const seated = (await store.listSeatedBy('p1')).map((r) => r.id);
        expect([...seated].sort()).toEqual(['r1', 'r2']);
      }));

    it('listSeatedBy orders most recently played first', async () =>
      withStore(async ({ store }) => {
        const first = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(first);
        await store.create(roomAt('r2', 'p1', 'p2', 2000));

        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r2', 'r1']);

        await saveFresh(store, touch(first, at(3000)));
        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r1', 'r2']);
      }));

    it('listSeatedBy skips finished games', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });
        expect(await store.listSeatedBy('p1')).toEqual([]);
      }));

    it('save writes the updatedAt the room carries', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);

        await saveFresh(store, touch(room, at(5000)));

        expect((await store.get('r1'))?.updatedAt).toEqual(at(5000));
      }));

    it('save leaves the room start alone', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);

        await saveFresh(store, touch({ ...room, createdAt: at(9000) }, at(5000)));

        expect((await store.get('r1'))?.createdAt).toEqual(at(1000));
      }));

    it('listSeatedBy is empty before anything is created', async () =>
      withStore(async ({ store }) => {
        expect(await store.listSeatedBy('p1')).toEqual([]);
      }));

    it('get on missing room returns undefined', async () =>
      withStore(async ({ store }) => {
        expect(await store.get('nope')).toBeUndefined();
      }));

    it('getForUpdate returns the room and a version', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);

        const current = await store.getForUpdate('r1');
        expect(current?.value).toEqual(room);
        expect(current?.version).toEqual(expect.any(Number));
      }));

    it('getForUpdate on a missing room returns undefined', async () =>
      withStore(async ({ store }) => {
        expect(await store.getForUpdate('nope')).toBeUndefined();
      }));

    it('a second save against one read is refused', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');

        await store.save(touch(room, at(2000)), read.version);
        await expect(store.save(touch(room, at(3000)), read.version)).rejects.toBeInstanceOf(
          ConcurrentModificationError,
        );

        expect((await store.get('r1'))?.updatedAt).toEqual(at(2000));
      }));

    it('the version a save leaves behind is the one the next save needs', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);

        const first = await store.getForUpdate('r1');
        if (first === undefined) throw new Error('expected r1');
        await store.save(touch(room, at(2000)), first.version);

        const second = await store.getForUpdate('r1');
        if (second === undefined) throw new Error('expected r1');
        expect(second.version).not.toBe(first.version);
        await expect(store.save(touch(room, at(3000)), second.version)).resolves.toBeUndefined();
      }));

    // A room a finished game deleted stays deleted: `save` is an update, not an
    // upsert, so a move that read it first cannot write it back.
    it('save on a deleted room is refused rather than recreating it', async () =>
      withStore(async ({ store, unitOfWork }) => {
        const room = roomAt('r1', 'p1', 'p2', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');

        await unitOfWork.commit([store.deleteOp('r1', read.version)]);

        await expect(store.save(touch(room, at(2000)), read.version)).rejects.toBeInstanceOf(
          ConcurrentModificationError,
        );
        expect(await store.get('r1')).toBeUndefined();
      }));
  });
};
