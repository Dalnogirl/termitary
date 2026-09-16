import {
  BASE_RULESET,
  type Ruleset,
  applyMove,
  createGame,
  listValidMoves,
} from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import type { Identity } from '../domain/identity.js';
import type { RoomOverview } from '../domain/room-store.js';
import { type Room, createRoom, seatPlayer } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import { listRooms, summarize } from './list-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });
const NOW = new Date(1234);
const PLAYERS = ['alice', 'bob', 'carol', 'alice-secret'];

const overviewOf = (room: Room): RoomOverview => ({
  id: room.id,
  players: room.players,
  status: room.state.status,
  updatedAt: new Date(0),
  ruleset: room.ruleset,
});

const BASE_WIRE = { pieces: { ...BASE_RULESET.pieces } };
const LADYBUG: Ruleset = { pieces: { ...BASE_RULESET.pieces, ladybug: 1 } };

describe('summarize', () => {
  it('counts an empty room as 0 players', () => {
    const empty = overviewOf({
      ...createRoom('r1', ident('alice'), 'white', NOW),
      players: { white: undefined, black: undefined },
    });
    expect(summarize(empty)).toEqual({
      roomId: 'r1',
      playerCount: 0,
      status: 'in_progress',
      ruleset: BASE_WIRE,
    });
  });

  it('counts a single-seated room as 1 player', () => {
    expect(summarize(overviewOf(createRoom('r1', ident('alice'), 'white', NOW)))).toEqual({
      roomId: 'r1',
      playerCount: 1,
      status: 'in_progress',
      ruleset: BASE_WIRE,
    });
  });

  it('counts a fully-seated room as 2 players', () => {
    const full = seatPlayer(createRoom('r1', ident('alice'), 'white', NOW), ident('bob'));
    expect(summarize(overviewOf(full))).toEqual({
      roomId: 'r1',
      playerCount: 2,
      status: 'in_progress',
      ruleset: BASE_WIRE,
    });
  });

  it('carries the room ruleset, so the lobby can badge it', () => {
    const room = createRoom('r1', ident('alice'), 'white', NOW, LADYBUG);
    expect(summarize(overviewOf(room)).ruleset).toEqual({ pieces: LADYBUG.pieces });
  });

  it('reflects finished game status', () => {
    const base = createRoom('r1', ident('alice'), 'white', NOW);
    // Hand-craft a finished state — exhaustively playing to a queen-surround
    // here is overkill. We mutate via the type.
    const finished = {
      ...base,
      state: {
        ...createGame(),
        status: 'finished' as const,
        result: 'draw' as const,
        endReason: 'queen-surrounded' as const,
      },
    };
    expect(summarize(overviewOf(finished)).status).toBe('finished');
  });
});

describe('listRooms', () => {
  it('does not sweep: reading the lobby writes nothing', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice'), 'white', new Date(0)));

    expect(await listRooms(ident('bob'), store)).toHaveLength(1);
  });

  it('returns an empty array when no rooms exist', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    expect(await listRooms(ident('bob'), store)).toEqual([]);
  });

  it('returns a summary per open room', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice'), 'white', NOW));
    await store.create(createRoom('r2', ident('carol'), 'white', NOW));
    const result = await listRooms(ident('bob'), store);
    expect(result.map((r) => ({ roomId: r.roomId, playerCount: r.playerCount }))).toEqual(
      expect.arrayContaining([
        { roomId: 'r1', playerCount: 1 },
        { roomId: 'r2', playerCount: 1 },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('omits rooms the caller is already seated in', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('mine', ident('alice'), 'white', NOW));
    await store.create(createRoom('theirs', ident('bob'), 'white', NOW));
    expect((await listRooms(ident('alice'), store)).map((r) => r.roomId)).toEqual(['theirs']);
  });

  it('omits full rooms', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(seatPlayer(createRoom('r1', ident('alice'), 'white', NOW), ident('bob')));
    expect(await listRooms(ident('carol'), store)).toEqual([]);
  });

  it('does not expose playerIds', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice-secret'), 'white', NOW));
    const result = await listRooms(ident('bob'), store);
    expect(JSON.stringify(result)).not.toContain('alice-secret');
  });

  it('summary status follows the game state', async () => {
    const { rooms: store } = createTestStores(PLAYERS);
    await store.create(createRoom('r1', ident('alice'), 'white', NOW));
    // Advance one engine move to confirm the wrapper passes through cleanly.
    const r2 = createRoom('r2', ident('alice'), 'white', NOW);
    const firstMove = listValidMoves(r2.state)[0];
    if (!firstMove) throw new Error('no first move');
    await store.create({ ...r2, state: applyMove(r2.state, firstMove) });
    const result = await listRooms(ident('bob'), store);
    for (const r of result) expect(r.status).toBe('in_progress');
  });
});
