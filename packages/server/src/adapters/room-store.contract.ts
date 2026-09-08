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

    it('list returns an overview per room', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p1')));
        await store.create(seatPlayer(createRoom('r2', ident('p1')), ident('p2')));
        const rooms = [...(await store.list())].sort((a, b) => a.id.localeCompare(b.id));
        expect(rooms).toEqual([
          { id: 'r1', players: { white: ident('p1'), black: undefined }, status: 'in_progress' },
          { id: 'r2', players: { white: ident('p1'), black: ident('p2') }, status: 'in_progress' },
        ]);
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

    it('list is empty before anything is created', async () =>
      withStore(async ({ store }) => {
        expect(await store.list()).toEqual([]);
      }));

    it('get on missing room returns undefined', async () =>
      withStore(async ({ store }) => {
        expect(await store.get('nope')).toBeUndefined();
      }));
  });
};
