import {
  BASE_RULESET,
  type Ruleset,
  applyMove,
  createGame,
  listValidMoves,
  replayFrames,
  resign,
} from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { ClientMessageSchema } from './client-messages.js';
import { ServerMessageSchema } from './server-messages.js';
import {
  WireGameStateSchema,
  WireRulesetSchema,
  fromWire,
  fromWireRuleset,
  toWire,
  toWireRuleset,
} from './wire.js';

const SPIDERLESS: Ruleset = { pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } };

const playN = (n: number, ruleset: Ruleset = BASE_RULESET) => {
  let state = createGame(ruleset);
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

  it('round-trips a ruleset the game was played under, and the sparse hands it deals', () => {
    const state = playN(8, SPIDERLESS);
    const reparsed = WireGameStateSchema.parse(JSON.parse(JSON.stringify(toWire(state))));
    const restored = fromWire(reparsed);

    expect(restored.ruleset).toEqual(SPIDERLESS);
    expect(restored.hands).toEqual(state.hands);
    expect(restored.hands.white).not.toHaveProperty('spider');
  });

  it('reads a state stored before the wire carried a ruleset as base', () => {
    const { ruleset: _dropped, ...legacy } = toWire(playN(4));
    const restored = fromWire(WireGameStateSchema.parse(JSON.parse(JSON.stringify(legacy))));

    expect(restored.ruleset).toEqual(BASE_RULESET);
    expect(replayFrames(restored.history, restored.ruleset).at(-1)?.board.cells).toEqual(
      restored.board.cells,
    );
  });

  it('keeps an exhausted piece type as a zero rather than dropping the key', () => {
    const hand = { ...createGame().hands.white, queen: 0 };
    const wire = toWire({ ...createGame(), hands: { white: hand, black: hand } });

    expect(WireGameStateSchema.safeParse(wire).success).toBe(true);
    expect(fromWire(WireGameStateSchema.parse(wire)).hands.white.queen).toBe(0);
  });

  it('rejects a hand holding a piece type the ruleset does not include', () => {
    const wire = toWire(createGame(SPIDERLESS));
    const smuggled = {
      ...wire,
      hands: { ...wire.hands, black: { ...wire.hands.black, spider: 2 } },
    };

    expect(WireGameStateSchema.safeParse(smuggled).success).toBe(false);
  });

  it('judges a hand against base when the state carries no ruleset', () => {
    const { ruleset: _dropped, ...legacy } = toWire(createGame());

    expect(WireGameStateSchema.safeParse(legacy).success).toBe(true);
    expect(
      WireGameStateSchema.safeParse({
        ...legacy,
        hands: { ...legacy.hands, white: { ...legacy.hands.white, ladybug: 1 } },
      }).success,
    ).toBe(false);
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
    const seated = { status: 'connected', userId: 'u2', name: 'Amber Beetle' };
    const samples = [
      { type: 'connected', playerId: 'p1' },
      {
        type: 'gameJoined',
        roomId: 'r1',
        playerColor: 'black',
        state,
        opponent: { status: 'empty' },
      },
      { type: 'gameJoined', roomId: 'r1', playerColor: 'black', state, opponent: seated },
      {
        type: 'gameJoined',
        roomId: 'r1',
        playerColor: 'black',
        state,
        opponent: { ...seated, status: 'disconnected' },
      },
      { type: 'stateUpdated', roomId: 'r1', state },
      { type: 'presenceUpdate', roomId: 'r1', opponent: seated },
      { type: 'presenceUpdate', roomId: 'r1', opponent: { ...seated, status: 'disconnected' } },
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
      ServerMessageSchema.safeParse({
        type: 'presenceUpdate',
        roomId: 'r1',
        opponent: { status: 'empty' },
      }).success,
    ).toBe(false);
  });

  it('rejects a seated opponent with no id to link to', () => {
    expect(
      ServerMessageSchema.safeParse({
        type: 'presenceUpdate',
        roomId: 'r1',
        opponent: { status: 'connected', name: 'Amber Beetle' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown client message types', () => {
    // createGame used to be a WS message; it's now a REST POST. Asserting it
    // is rejected ensures the protocol surface stays minimal.
    expect(ClientMessageSchema.safeParse({ type: 'createGame' }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: 'ping' }).success).toBe(false);
  });

  it('round-trips a ruleset through JSON', () => {
    const ruleset = { pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } };
    const parsed = WireRulesetSchema.parse(JSON.parse(JSON.stringify(toWireRuleset(ruleset))));

    expect(fromWireRuleset(parsed)).toEqual(ruleset);
    expect(fromWireRuleset(WireRulesetSchema.parse(toWireRuleset(BASE_RULESET)))).toEqual(
      BASE_RULESET,
    );
  });

  it('rejects a ruleset naming a piece type it does not know', () => {
    expect(WireRulesetSchema.safeParse({ pieces: { queen: 1, ladybug: 1 } }).success).toBe(false);
  });

  it('rejects a zero count rather than reading it as absent', () => {
    expect(WireRulesetSchema.safeParse({ pieces: { queen: 1, spider: 0 } }).success).toBe(false);
  });
});
