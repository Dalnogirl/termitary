import { applyMove, createGame, listValidMoves, resign } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { ClientMessageSchema } from './client-messages.js';
import { ServerMessageSchema } from './server-messages.js';
import { WireGameStateSchema, fromWire, toWire } from './wire.js';

const playN = (n: number) => {
  let state = createGame();
  for (let i = 0; i < n; i++) {
    const moves = listValidMoves(state);
    const move = moves[0];
    if (!move) break;
    state = applyMove(state, move);
    if (state.status === 'finished') break;
  }
  return state;
};

describe('wire serialization', () => {
  it('round-trips the initial game state through JSON', () => {
    const state = createGame();
    const wire = toWire(state);
    const json = JSON.stringify(wire);
    const reparsed = WireGameStateSchema.parse(JSON.parse(json));
    const restored = fromWire(reparsed);

    expect(restored.status).toBe('in_progress');
    expect(restored.currentPlayer).toBe('white');
    expect(restored.hands).toEqual(state.hands);
    expect(restored.turnNumbers).toEqual(state.turnNumbers);
    expect(restored.board.cells.size).toBe(0);
    expect(restored.history).toEqual([]);
  });

  it('round-trips a mid-game state with stacked board cells', () => {
    const state = playN(20);
    const wire = toWire(state);
    const json = JSON.stringify(wire);
    const reparsed = WireGameStateSchema.parse(JSON.parse(json));
    const restored = fromWire(reparsed);

    expect(restored.status).toBe(state.status);
    expect(restored.currentPlayer).toBe(state.currentPlayer);
    expect(restored.turnNumbers).toEqual(state.turnNumbers);
    expect(restored.hands).toEqual(state.hands);
    expect(restored.history.length).toBe(state.history.length);
    expect(restored.board.cells.size).toBe(state.board.cells.size);
    for (const [k, stack] of state.board.cells) {
      expect(restored.board.cells.get(k)).toEqual(stack);
    }
  });

  it('round-trips a resigned game with its end reason', () => {
    const state = resign(playN(6), 'white');
    const reparsed = WireGameStateSchema.parse(JSON.parse(JSON.stringify(toWire(state))));
    const restored = fromWire(reparsed);

    expect(restored.status).toBe('finished');
    if (restored.status === 'finished') {
      expect(restored.result).toBe('black-wins');
      expect(restored.endReason).toBe('resignation');
    }
  });

  it('rejects a finished state with no end reason', () => {
    const finished = toWire(resign(playN(6), 'white'));
    if (finished.status !== 'finished') throw new Error('unreachable');
    const { endReason: _dropped, ...missing } = finished;
    expect(WireGameStateSchema.safeParse(missing).success).toBe(false);
  });

  it('rejects board entries with extra fields via strict piece schema', () => {
    const bad = {
      status: 'in_progress',
      board: { '0,0': [{ type: 'queen', color: 'white', extra: 1 }] },
      hands: {
        white: { queen: 0, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
        black: { queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
      },
      currentPlayer: 'black',
      turnNumbers: { white: 1, black: 0 },
      history: [],
    };
    expect(WireGameStateSchema.safeParse(bad).success).toBe(false);
  });
});

describe('message schemas', () => {
  it('parses each ClientMessage variant', () => {
    const samples = [
      { type: 'joinGame', roomId: 'r1' },
      {
        type: 'makeMove',
        roomId: 'r1',
        move: { kind: 'place', piece: { type: 'queen', color: 'white' }, to: { q: 0, r: 0 } },
      },
      { type: 'resign', roomId: 'r1' },
    ];
    for (const s of samples) {
      expect(ClientMessageSchema.safeParse(s).success).toBe(true);
    }
  });

  it('parses each ServerMessage variant', () => {
    const state = toWire(createGame());
    const samples = [
      { type: 'connected', playerId: 'p1' },
      { type: 'gameJoined', roomId: 'r1', playerColor: 'black', state, opponent: 'empty' },
      { type: 'gameJoined', roomId: 'r1', playerColor: 'black', state, opponent: 'connected' },
      { type: 'gameJoined', roomId: 'r1', playerColor: 'black', state, opponent: 'disconnected' },
      { type: 'stateUpdated', roomId: 'r1', state },
      { type: 'presenceUpdate', roomId: 'r1', opponent: 'connected' },
      { type: 'presenceUpdate', roomId: 'r1', opponent: 'disconnected' },
      { type: 'error', message: 'oops' },
      { type: 'error', message: 'oops', requestKind: 'makeMove' },
    ];
    for (const s of samples) {
      expect(ServerMessageSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects presenceUpdate with non-event opponent values', () => {
    // 'empty' is a snapshot-only state (only present on gameJoined); a
    // presenceUpdate carrying it would imply a vacate-but-room-still-alive
    // transition, which nothing in the protocol produces.
    expect(
      ServerMessageSchema.safeParse({ type: 'presenceUpdate', roomId: 'r1', opponent: 'empty' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown client message types', () => {
    // createGame used to be a WS message; it's now a REST POST. Asserting it
    // is rejected ensures the protocol surface stays minimal.
    expect(ClientMessageSchema.safeParse({ type: 'createGame' }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: 'ping' }).success).toBe(false);
  });
});
