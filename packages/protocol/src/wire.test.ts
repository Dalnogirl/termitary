import { applyMove, createGame, listValidMoves } from '@hive/engine';
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
      { type: 'createGame' },
      { type: 'joinGame', roomId: 'r1' },
      {
        type: 'makeMove',
        roomId: 'r1',
        move: { kind: 'place', piece: { type: 'queen', color: 'white' }, to: { q: 0, r: 0 } },
      },
      { type: 'leaveGame', roomId: 'r1' },
    ];
    for (const s of samples) {
      expect(ClientMessageSchema.safeParse(s).success).toBe(true);
    }
  });

  it('parses each ServerMessage variant', () => {
    const state = toWire(createGame());
    const samples = [
      { type: 'connected', playerId: 'p1' },
      { type: 'gameCreated', roomId: 'r1', playerColor: 'white', state },
      { type: 'gameJoined', roomId: 'r1', playerColor: 'black', state },
      { type: 'stateUpdated', roomId: 'r1', state },
      { type: 'error', message: 'oops' },
      { type: 'error', message: 'oops', requestKind: 'makeMove' },
    ];
    for (const s of samples) {
      expect(ServerMessageSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects unknown client message types', () => {
    expect(ClientMessageSchema.safeParse({ type: 'ping' }).success).toBe(false);
  });
});
