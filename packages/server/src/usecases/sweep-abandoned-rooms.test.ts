import { describe, expect, it } from 'vitest';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import type { Identity } from '../domain/identity.js';
import { createRoom, seatPlayer } from '../domain/room.js';
import { ABANDONED_ROOM_TTL_MS, sweepAbandonedRooms } from './sweep-abandoned-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });
const at = (ms: number) => new Date(ms);

describe('sweepAbandonedRooms', () => {
  const storeWithRoomAt = async (written: Date) => {
    const store = createInMemoryRoomStore(() => written);
    await store.create(createRoom('r1', ident('alice')));
    return { store };
  };

  it('keeps a room that reached the cutoff exactly', async () => {
    const { store } = await storeWithRoomAt(at(0));
    expect(await sweepAbandonedRooms(store, at(ABANDONED_ROOM_TTL_MS))).toBe(0);
    expect(await store.get('r1')).toBeDefined();
  });

  it('removes a room once it is past the cutoff', async () => {
    const { store } = await storeWithRoomAt(at(0));
    expect(await sweepAbandonedRooms(store, at(ABANDONED_ROOM_TTL_MS + 1))).toBe(1);
    expect(await store.get('r1')).toBeUndefined();
  });

  it('leaves a full game in progress alone however old', async () => {
    let clock = at(0);
    const store = createInMemoryRoomStore(() => clock);
    await store.create(seatPlayer(createRoom('r1', ident('alice')), ident('bob')));

    clock = at(ABANDONED_ROOM_TTL_MS * 365);
    expect(await sweepAbandonedRooms(store, clock)).toBe(0);
    expect(await store.get('r1')).toBeDefined();
  });

  it('counts every room it removes', async () => {
    const { store } = await storeWithRoomAt(at(0));
    await store.create(createRoom('r2', ident('bob')));
    expect(await sweepAbandonedRooms(store, at(ABANDONED_ROOM_TTL_MS + 1))).toBe(2);
  });
});
