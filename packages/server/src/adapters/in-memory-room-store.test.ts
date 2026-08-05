import { describe, expect, it } from 'vitest';
import { RoomAlreadyExistsError } from '../domain/room-store.js';
import { createRoom } from '../domain/room.js';
import { createInMemoryRoomStore } from './in-memory-room-store.js';

const ident = (id: string) => ({ playerId: id });

describe('InMemoryRoomStore', () => {
  it('create + get round-trips', async () => {
    const store = createInMemoryRoomStore();
    const room = createRoom('r1', ident('p1'));
    await store.create(room);
    expect(await store.get('r1')).toEqual(room);
  });

  it('create rejects duplicate ids', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('p1')));
    await expect(store.create(createRoom('r1', ident('p2')))).rejects.toBeInstanceOf(
      RoomAlreadyExistsError,
    );
  });

  it('save overwrites existing rooms', async () => {
    const store = createInMemoryRoomStore();
    const original = createRoom('r1', ident('p1'));
    await store.create(original);
    const updated = { ...original, players: [ident('p1'), ident('p2')] as const };
    await store.save(updated);
    expect(await store.get('r1')).toEqual(updated);
  });

  it('delete removes rooms', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('p1')));
    await store.delete('r1');
    expect(await store.get('r1')).toBeUndefined();
  });

  it('list returns all rooms', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('p1')));
    await store.create(createRoom('r2', ident('p2')));
    const rooms = await store.list();
    expect(rooms.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('get on missing room returns undefined', async () => {
    const store = createInMemoryRoomStore();
    expect(await store.get('nope')).toBeUndefined();
  });
});
