import { BASE_RULESET } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import type { Identity } from '../domain/identity.js';
import { createRoom, seatPlayer } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import { listMyRooms } from './list-my-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });
const NOW = new Date(1234);
const PLAYERS = ['alice', 'bob', 'bob-secret'];
const BASE_WIRE = { pieces: { ...BASE_RULESET.pieces } };

describe('listMyRooms', () => {
  it('is empty when the player sits nowhere', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice'), 'white', NOW));
    expect(await listMyRooms(ident('bob'), store)).toEqual([]);
  });

  it('reports the seat the player holds', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('white-room', ident('alice'), 'white', NOW));
    await store.create(
      seatPlayer(createRoom('black-room', ident('bob'), 'white', NOW), ident('alice')),
    );

    const mine = await listMyRooms(ident('alice'), store);
    expect(mine).toEqual(
      expect.arrayContaining([
        {
          roomId: 'white-room',
          seat: 'white',
          playerCount: 1,
          updatedAt: 1234,
          ruleset: BASE_WIRE,
        },
        {
          roomId: 'black-room',
          seat: 'black',
          playerCount: 2,
          updatedAt: 1234,
          ruleset: BASE_WIRE,
        },
      ]),
    );
    expect(mine).toHaveLength(2);
  });

  it('does not expose the opponent playerId', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(
      seatPlayer(createRoom('r1', ident('alice'), 'white', NOW), ident('bob-secret')),
    );
    const mine = await listMyRooms(ident('alice'), store);
    expect(JSON.stringify(mine)).not.toContain('bob-secret');
  });

  it('lists a room per seat held, several at once', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice'), 'white', NOW));
    await store.create(createRoom('r2', ident('alice'), 'white', NOW));
    expect((await listMyRooms(ident('alice'), store)).map((r) => r.roomId).sort()).toEqual([
      'r1',
      'r2',
    ]);
  });
});
