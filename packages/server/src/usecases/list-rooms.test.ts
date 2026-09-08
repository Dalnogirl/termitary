import { applyMove, createGame, listValidMoves } from '@hive/engine';
import { describe, expect, it } from 'vitest';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import type { Identity } from '../domain/identity.js';
import { createRoom, seatPlayer } from '../domain/room.js';
import { listRooms, summarize } from './list-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });

describe('summarize', () => {
  it('counts an empty room as 0 players', () => {
    const empty = {
      ...createRoom('r1', ident('alice')),
      players: { white: undefined, black: undefined },
    };
    expect(summarize(empty)).toEqual({ roomId: 'r1', playerCount: 0, status: 'in_progress' });
  });

  it('counts a single-seated room as 1 player', () => {
    expect(summarize(createRoom('r1', ident('alice')))).toEqual({
      roomId: 'r1',
      playerCount: 1,
      status: 'in_progress',
    });
  });

  it('counts a fully-seated room as 2 players', () => {
    const full = seatPlayer(createRoom('r1', ident('alice')), ident('bob'));
    expect(summarize(full)).toEqual({ roomId: 'r1', playerCount: 2, status: 'in_progress' });
  });

  it('reflects finished game status', () => {
    const base = createRoom('r1', ident('alice'));
    // Hand-craft a finished state — exhaustively playing to a queen-surround
    // here is overkill. We mutate via the type.
    const finished = {
      ...base,
      state: {
        ...createGame(),
        status: 'finished' as const,
        result: 'draw' as const,
      },
    };
    expect(summarize(finished).status).toBe('finished');
  });
});

describe('listRooms', () => {
  it('returns an empty array when no rooms exist', async () => {
    const store = createInMemoryRoomStore();
    expect(await listRooms(store)).toEqual([]);
  });

  it('returns a summary per stored room', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('alice')));
    await store.create(seatPlayer(createRoom('r2', ident('alice')), ident('bob')));
    const result = await listRooms(store);
    expect(result.map((r) => ({ roomId: r.roomId, playerCount: r.playerCount }))).toEqual(
      expect.arrayContaining([
        { roomId: 'r1', playerCount: 1 },
        { roomId: 'r2', playerCount: 2 },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('does not expose playerIds', async () => {
    const store = createInMemoryRoomStore();
    await store.create(createRoom('r1', ident('alice-secret')));
    const result = await listRooms(store);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('alice-secret');
  });

  it('summary status follows the game state', async () => {
    const store = createInMemoryRoomStore();
    // In-progress room
    await store.create(createRoom('r1', ident('alice')));
    // Advance one engine move to confirm the wrapper passes through cleanly.
    const r2 = createRoom('r2', ident('alice'));
    const firstMove = listValidMoves(r2.state)[0];
    if (!firstMove) throw new Error('no first move');
    await store.create({ ...r2, state: applyMove(r2.state, firstMove) });
    const result = await listRooms(store);
    for (const r of result) expect(r.status).toBe('in_progress');
  });
});
