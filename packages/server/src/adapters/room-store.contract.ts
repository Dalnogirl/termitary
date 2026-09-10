import { describe, expect, it } from 'vitest';
import { RoomAlreadyExistsError, type RoomStore } from '../domain/room-store.js';
import { createRoom, seatPlayer } from '../domain/room.js';

export type StoreHarness = {
  readonly store: RoomStore;
  /** Moves the store's clock, so sweep cases do not wait in real time. */
  setNow(at: Date): void;
  /** Seats are a foreign key in persisting stores; the id has to exist. */
  seedUser(id: string): Promise<void>;
  cleanup?(): void;
};

const ident = (id: string) => ({ playerId: id });

// Playing to a real queen surround here would say nothing about the store.
const FINISHED = { status: 'finished', result: 'draw' } as const;

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
        const room = createRoom('r1', ident('p1'));
        await store.create(room);
        expect(await store.get('r1')).toEqual(room);
      }));

    it('create rejects duplicate ids', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p1')));
        await expect(store.create(createRoom('r1', ident('p2')))).rejects.toBeInstanceOf(
          RoomAlreadyExistsError,
        );
      }));

    it('save overwrites existing rooms', async () =>
      withStore(async ({ store }) => {
        const original = createRoom('r1', ident('p1'));
        await store.create(original);
        const updated = { ...original, players: { white: ident('p1'), black: ident('p2') } };
        await store.save(updated);
        expect(await store.get('r1')).toEqual(updated);
      }));

    it('save clears an emptied seat', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p1'));
        await store.create({ ...room, players: { white: ident('p1'), black: ident('p2') } });
        await store.save({ ...room, players: { white: undefined, black: ident('p2') } });
        const stored = await store.get('r1');
        expect(stored?.players).toEqual({ white: undefined, black: ident('p2') });
      }));

    it('delete removes rooms', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p1')));
        await store.delete('r1');
        expect(await store.get('r1')).toBeUndefined();
      }));

    it('delete on a missing room is a no-op', async () =>
      withStore(async ({ store }) => {
        await expect(store.delete('nope')).resolves.toBeUndefined();
      }));

    it('listSeatedBy returns an overview per room the player sits in', async () =>
      withStore(async ({ store, setNow }) => {
        setNow(new Date(1000));
        await store.create(createRoom('r1', ident('p1')));
        await store.create(seatPlayer(createRoom('r2', ident('p2')), ident('p1')));
        await store.create(createRoom('r3', ident('p2')));

        const mine = [...(await store.listSeatedBy('p1'))].sort((a, b) => a.id.localeCompare(b.id));
        expect(mine).toEqual([
          {
            id: 'r1',
            players: { white: ident('p1'), black: undefined },
            status: 'in_progress',
            updatedAt: new Date(1000),
          },
          {
            id: 'r2',
            players: { white: ident('p2'), black: ident('p1') },
            status: 'in_progress',
            updatedAt: new Date(1000),
          },
        ]);
      }));

    it('listSeatedBy finds a player in either seat', async () =>
      withStore(async ({ store }) => {
        await store.create(seatPlayer(createRoom('r1', ident('p2')), ident('p1')));
        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listSeatedBy orders most recently played first', async () =>
      withStore(async ({ store, setNow }) => {
        setNow(new Date(1000));
        const first = createRoom('r1', ident('p1'));
        await store.create(first);
        setNow(new Date(2000));
        await store.create(createRoom('r2', ident('p1')));

        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r2', 'r1']);

        setNow(new Date(3000));
        await store.save(first);
        expect((await store.listSeatedBy('p1')).map((r) => r.id)).toEqual(['r1', 'r2']);
      }));

    it('listSeatedBy skips finished games', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p1'));
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });
        expect(await store.listSeatedBy('p1')).toEqual([]);
      }));

    it('listOpenExcluding keeps rooms with a free seat that are not yours', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p2')));
        await store.create(createRoom('r2', ident('p1')));
        await store.create(seatPlayer(createRoom('r3', ident('p2')), ident('p3')));

        expect((await store.listOpenExcluding('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listOpenExcluding keeps a room with both seats empty', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p1'));
        await store.save({ ...room, players: { white: undefined, black: undefined } });
        expect((await store.listOpenExcluding('p1')).map((r) => r.id)).toEqual(['r1']);
      }));

    it('listOpenExcluding skips finished games', async () =>
      withStore(async ({ store }) => {
        const room = createRoom('r1', ident('p2'));
        await store.create({ ...room, state: { ...room.state, ...FINISHED } });
        expect(await store.listOpenExcluding('p1')).toEqual([]);
      }));

    it('sweeps a room with a free seat once it is older than the cutoff', async () =>
      withStore(async ({ store, setNow }) => {
        setNow(new Date(1000));
        await store.create(createRoom('r1', ident('p1')));

        expect(await store.deleteAbandonedBefore(new Date(1000))).toBe(0);
        expect(await store.get('r1')).toBeDefined();

        expect(await store.deleteAbandonedBefore(new Date(2000))).toBe(1);
        expect(await store.get('r1')).toBeUndefined();
      }));

    it('never sweeps a full game in progress', async () =>
      withStore(async ({ store, setNow }) => {
        setNow(new Date(1000));
        await store.create(seatPlayer(createRoom('r1', ident('p1')), ident('p2')));

        expect(await store.deleteAbandonedBefore(new Date(9999))).toBe(0);
        expect(await store.get('r1')).toBeDefined();
      }));

    it('a save resets the clock a sweep measures', async () =>
      withStore(async ({ store, setNow }) => {
        setNow(new Date(1000));
        const room = createRoom('r1', ident('p1'));
        await store.create(room);

        setNow(new Date(5000));
        await store.save(room);

        expect(await store.deleteAbandonedBefore(new Date(4000))).toBe(0);
        expect(await store.get('r1')).toBeDefined();
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
  });
};
