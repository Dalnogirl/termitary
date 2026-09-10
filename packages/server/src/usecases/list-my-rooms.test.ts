import { describe, expect, it } from 'vitest';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import type { Identity } from '../domain/identity.js';
import { createRoom, seatPlayer } from '../domain/room.js';
import { listMyRooms } from './list-my-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });

describe('listMyRooms', () => {
  it('is empty when the player sits nowhere', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('alice')));
    expect(await listMyRooms(ident('bob'), store)).toEqual([]);
  });

  it('reports the seat the player holds', async () => {
    const store = createInMemoryRoomStore(() => new Date(1234));
    await store.create(createRoom('white-room', ident('alice')));
    await store.create(seatPlayer(createRoom('black-room', ident('bob')), ident('alice')));

    const mine = await listMyRooms(ident('alice'), store);
    expect(mine).toEqual(
      expect.arrayContaining([
        { roomId: 'white-room', seat: 'white', playerCount: 1, updatedAt: 1234 },
        { roomId: 'black-room', seat: 'black', playerCount: 2, updatedAt: 1234 },
      ]),
    );
    expect(mine).toHaveLength(2);
  });

  it('does not expose the opponent playerId', async () => {
    const store = createInMemoryRoomStore();
    await store.create(seatPlayer(createRoom('r1', ident('alice')), ident('bob-secret')));
    const mine = await listMyRooms(ident('alice'), store);
    expect(JSON.stringify(mine)).not.toContain('bob-secret');
  });

  it('lists a room per seat held, several at once', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('alice')));
    await store.create(createRoom('r2', ident('alice')));
    expect((await listMyRooms(ident('alice'), store)).map((r) => r.roomId).sort()).toEqual([
      'r1',
      'r2',
    ]);
  });
});
