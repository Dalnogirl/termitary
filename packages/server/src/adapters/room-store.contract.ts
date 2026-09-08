import { describe, expect, it } from 'vitest';
import { RoomAlreadyExistsError, type RoomStore } from '../domain/room-store.js';
import { createRoom } from '../domain/room.js';

export type StoreHarness = {
  readonly store: RoomStore;
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

    it('list returns all rooms', async () =>
      withStore(async ({ store }) => {
        await store.create(createRoom('r1', ident('p1')));
        await store.create(createRoom('r2', ident('p2')));
        const rooms = await store.list();
        expect(rooms.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
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
