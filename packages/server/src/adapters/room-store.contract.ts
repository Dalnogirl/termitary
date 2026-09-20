import { BASE_RULESET, type Ruleset } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import {
  ConcurrentModificationError,
  RoomAlreadyExistsError,
  type RoomStore,
} from '../domain/room-store.js';
import { type Room, createRoom, seatPlayer, touch } from '../domain/room.js';

export type StoreHarness = {
  readonly store: RoomStore;
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
// would fail every ordering and sweep case below.
const roomAt = (id: string, owner: string, ms: number) =>
  createRoom(id, ident(owner), 'white', at(ms));

// One piece short of base, so a store that quietly rebuilt a base game passes
// nothing below.
const NO_SPIDERS: Ruleset = { pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } };

// Playing to a real queen surround here would say nothing about the store.
const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

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
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);
        expect(await store.get('r1')).toEqual(room);
      }));

    it('create + get preserves a non-base ruleset', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p1'), 'white', at(1000), NO_SPIDERS);
        await store.create(room);

        // Only the room's own ruleset: the hand inside `state` still goes over
        // the wire as five fixed keys, and stays base until S-6.4.
        expect((await store.get('r1'))?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('a listing carries each room ruleset, so the lobby can badge it', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p1'), 'white', at(1000), NO_SPIDERS));
        const [listed] = await store.listSeatedBy('p1');
        expect(listed?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('save preserves the ruleset', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p1'), 'white', at(1000), NO_SPIDERS);
        await store.create(room);

        await saveFresh(store, touch(seatPlayer(room, ident('p2')), at(2000)));

        expect((await store.get('r1'))?.ruleset).toEqual(NO_SPIDERS);
      }));

    it('a room created without a ruleset is base', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 1000));
        expect((await store.get('r1'))?.ruleset).toEqual(BASE_RULESET);
      }));

    it('create rejects duplicate ids', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 1000));
        await expect(store.create(roomAt('r1', 'p2', 1000))).rejects.toBeInstanceOf(
          RoomAlreadyExistsError,
        );
      }));

    it('save overwrites existing rooms', async () =>
      withStore(async ({ store }) => {
        const original = roomAt('r1', 'p1', 1000);
        await store.create(original);
        const updated = { ...original, players: { white: ident('p1'), black: ident('p2') } };
        await saveFresh(store, updated);
        expect(await store.get('r1')).toEqual(updated);
      }));

    it('save clears an emptied seat', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create({ ...room, players: { white: ident('p1'), black: ident('p2') } });
        await saveFresh(store, { ...room, players: { white: undefined, black: ident('p2') } });
        const stored = await store.get('r1');
        expect(stored?.players).toEqual({ white: undefined, black: ident('p2') });
      }));

    it('delete removes rooms', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 1000));
        await store.delete('r1');
        expect(await store.get('r1')).toBeUndefined();
      }));

    it('delete on a missing room is a no-op', async () =>
      withStore(async ({ store }) => {
        await expect(store.delete('nope')).resolves.toBeUndefined();
      }));

    it('listSeatedBy returns an overview per room the player sits in', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 1000));
        await store.create(seatPlayer(roomAt('r2', 'p2', 1000), ident('p1')));
        await store.create(roomAt('r3', 'p2', 1000));

        const mine = [...(await store.listSeatedBy('p1'))].sort((a, b) => a.id.localeCompare(b.id));
        expect(mine).toEqual([
          {
            id: 'r1',
            players: { white: ident('p1'), black: undefined },
            status: 'in_progress',
            updatedAt: new Date(1000),
            ruleset: BASE_RULESET,
          },
          {
            id: 'r2',
            players: { white: ident('p2'), black: ident('p1') },
            status: 'in_progress',
            updatedAt: new Date(1000),
            ruleset: BASE_RULESET,
          },
        ]);
      }));

    it('listSeatedBy finds a player in either seat', async () =>
      withStore(async ({ store }) => {
        await store.create(seatPlayer(roomAt('r1', 'p2', 1000), ident('p1')));
        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listSeatedBy orders most recently played first', async () =>
      withStore(async ({ store }) => {
        const first = roomAt('r1', 'p1', 1000);
        await store.create(first);
        await store.create(roomAt('r2', 'p1', 2000));

        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r2', 'r1']);

        await saveFresh(store, touch(first, at(3000)));
        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r1', 'r2']);
      }));

    it('listSeatedBy skips finished games', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });
        expect(await store.listSeatedBy('p1')).toEqual([]);
      }));

    it('listOpenExcluding keeps rooms with a free seat that are not yours', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p2', 1000));
        await store.create(roomAt('r2', 'p1', 1000));
        await store.create(seatPlayer(roomAt('r3', 'p2', 1000), ident('p3')));

        expect((await store.listOpenExcluding('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listOpenExcluding keeps a room with both seats empty', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);
        await saveFresh(store, { ...room, players: { white: undefined, black: undefined } });
        expect((await store.listOpenExcluding('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listOpenExcluding skips finished games', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p2', 1000);
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });
        expect(await store.listOpenExcluding('p1')).toEqual([]);
      }));

    it('sweeps a room with a free seat once it is older than the cutoff', async () =>
      withStore(async ({ store }) => {
        await store.create(roomAt('r1', 'p1', 1000));

        expect(await store.deleteAbandonedBefore(at(1000))).toBe(0);
        expect(await store.get('r1')).toBeDefined();

        expect(await store.deleteAbandonedBefore(at(2000))).toBe(1);
        expect(await store.get('r1')).toBeUndefined();
      }));

    it('never sweeps a full game in progress', async () =>
      withStore(async ({ store }) => {
        await store.create(seatPlayer(roomAt('r1', 'p1', 1000), ident('p2')));

        expect(await store.deleteAbandonedBefore(at(9999))).toBe(0);
        expect(await store.get('r1')).toBeDefined();
      }));

    // Finished games leave through listFinishedBefore and delete, so that the
    // sweep can archive each one before it goes.
    it('never sweeps a finished game, however old', async () =>
      withStore(async ({ store }) => {
        const room = seatPlayer(roomAt('r1', 'p1', 1000), ident('p2'));
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });

        expect(await store.deleteAbandonedBefore(at(9999))).toBe(0);
        expect(await store.get('r1')).toBeDefined();
      }));

    it('a save moves the clock a sweep measures', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);

        await saveFresh(store, touch(room, at(5000)));

        expect(await store.deleteAbandonedBefore(at(4000))).toBe(0);
        expect(await store.get('r1')).toBeDefined();
      }));

    it('save leaves the room start alone', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);

        await saveFresh(store, touch({ ...room, createdAt: at(9000) }, at(5000)));

        expect((await store.get('r1'))?.createdAt).toEqual(at(1000));
      }));

    it('listFinishedBefore returns whole finished rooms older than the cutoff', async () =>
      withStore(async ({ store }) => {
        const room = seatPlayer(roomAt('r1', 'p1', 1000), ident('p2'));
        const finished = touch({ ...room, state: { ...room.state, ...FINISHED } }, at(2000));
        await store.create(finished);

        expect(await store.listFinishedBefore(at(2000))).toEqual([]);
        expect(await store.listFinishedBefore(at(3000))).toEqual([finished]);
      }));

    it('listFinishedBefore skips games still in progress', async () =>
      withStore(async ({ store }) => {
        await store.create(seatPlayer(roomAt('r1', 'p1', 1000), ident('p2')));

        expect(await store.listFinishedBefore(at(9999))).toEqual([]);
      }));

    it('both listings are empty before anything is created', async () =>
      withStore(async ({ store }) => {
        expect(await store.listSeatedBy('p1')).toEqual([]);
        expect(await store.listOpenExcluding('p1')).toEqual([]);
      }));

    it('get on missing room returns undefined', async () =>
      withStore(async ({ store }) => {
        expect(await store.get('nope')).toBeUndefined();
      }));

    it('getForUpdate returns the room and a version', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
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
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');

        await store.save(touch(seatPlayer(room, ident('p2')), at(2000)), read.version);
        await expect(
          store.save(touch(seatPlayer(room, ident('p3')), at(3000)), read.version),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);

        expect((await store.get('r1'))?.players.black).toEqual(ident('p2'));
      }));

    it('the version a save leaves behind is the one the next save needs', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);

        const first = await store.getForUpdate('r1');
        if (first === undefined) throw new Error('expected r1');
        await store.save(touch(room, at(2000)), first.version);

        const second = await store.getForUpdate('r1');
        if (second === undefined) throw new Error('expected r1');
        expect(second.version).not.toBe(first.version);
        await expect(store.save(touch(room, at(3000)), second.version)).resolves.toBeUndefined();
      }));

    // The room a cancel deleted stays deleted: `save` is an update, not an
    // upsert, so a join that read it first cannot write it back.
    it('save on a deleted room is refused rather than recreating it', async () =>
      withStore(async ({ store }) => {
        const room = roomAt('r1', 'p1', 1000);
        await store.create(room);
        const read = await store.getForUpdate('r1');
        if (read === undefined) throw new Error('expected r1');

        await store.delete('r1');

        await expect(
          store.save(touch(seatPlayer(room, ident('p2')), at(2000)), read.version),
        ).rejects.toBeInstanceOf(ConcurrentModificationError);
        expect(await store.get('r1')).toBeUndefined();
      }));
  });
};
