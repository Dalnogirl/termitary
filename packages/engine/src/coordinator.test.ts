import { describe, expect, it } from 'vitest';
import { fromCells } from './board.js';
import {
  type GameState,
  IllegalMoveError,
  type Move,
  applyMove,
  createGame,
  listValidMoves,
} from './coordinator.js';
import { type HexCoord, key } from './hex.js';
import type { Piece } from './piece.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };
const WG: Piece = { type: 'grasshopper', color: 'white' };
const WB: Piece = { type: 'beetle', color: 'white' };
const WS: Piece = { type: 'spider', color: 'white' };
const BQ: Piece = { type: 'queen', color: 'black' };
const BA: Piece = { type: 'ant', color: 'black' };
const BG: Piece = { type: 'grasshopper', color: 'black' };
const BB: Piece = { type: 'beetle', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };

const placeMove = (state: GameState, piece: Piece, to: HexCoord): GameState =>
  applyMove(state, { kind: 'place', piece, to });

const expectInProgress = (s: GameState) => {
  if (s.status !== 'in_progress') throw new Error(`expected in_progress, got ${s.status}`);
  return s;
};

describe('createGame', () => {
  it('returns an in-progress game with white to move and full hands', () => {
    const s = expectInProgress(createGame());
    expect(s.currentPlayer).toBe('white');
    expect(s.history).toEqual([]);
    expect(s.turnNumbers).toEqual({ white: 0, black: 0 });
    expect([...s.board.cells]).toEqual([]);
    expect(s.hands.white).toEqual({ queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 });
    expect(s.hands.black).toEqual({ queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 });
  });
});

describe('applyMove: placement', () => {
  it("places white's first piece at origin and switches to black", () => {
    const s1 = expectInProgress(placeMove(createGame(), WA, ORIGIN));
    expect(s1.currentPlayer).toBe('black');
    expect(s1.turnNumbers).toEqual({ white: 1, black: 0 });
    expect(s1.history).toEqual([{ kind: 'place', piece: WA, to: ORIGIN }]);
    expect(s1.hands.white.ant).toBe(2);
  });

  it('throws when white tries to place elsewhere on turn 0', () => {
    expect(() => placeMove(createGame(), WA, E)).toThrow(IllegalMoveError);
  });

  it("throws when a wrong-color piece is placed on white's turn", () => {
    expect(() => placeMove(createGame(), BA, ORIGIN)).toThrow(IllegalMoveError);
  });

  it('allows black to place adjacent to white on turn 0', () => {
    const s = placeMove(createGame(), WA, ORIGIN);
    const s2 = expectInProgress(placeMove(s, BA, E));
    expect(s2.currentPlayer).toBe('white');
    expect(s2.turnNumbers).toEqual({ white: 1, black: 1 });
  });

  it('from turn 1 onward, rejects placement touching enemy color', () => {
    const s = placeMove(placeMove(createGame(), WA, ORIGIN), BA, E);
    expect(() => placeMove(s, WG, { q: 1, r: -1 })).toThrow(IllegalMoveError);
  });

  it('throws when piece type is exhausted in hand', () => {
    let s: GameState = createGame();
    s = placeMove(s, WQ, ORIGIN);
    s = placeMove(s, BA, E);
    // White already placed their only queen — second queen placement should fail.
    expect(() => placeMove(s, WQ, { q: -1, r: 0 })).toThrow(IllegalMoveError);
  });
});

describe('applyMove: queen-by-turn-4 enforcement', () => {
  it("on white's 4th turn with queen still in hand, only queen placements are legal", () => {
    let s: GameState = createGame();
    s = placeMove(s, WA, ORIGIN);
    s = placeMove(s, BA, E);
    s = placeMove(s, WG, { q: -1, r: 0 });
    s = placeMove(s, BG, { q: 2, r: 0 });
    s = placeMove(s, WB, { q: -2, r: 0 });
    s = placeMove(s, BB, { q: 3, r: 0 });
    const sLive = expectInProgress(s);
    expect(sLive.currentPlayer).toBe('white');
    expect(sLive.turnNumbers.white).toBe(3);
    expect(sLive.hands.white.queen).toBe(1);

    const moves = listValidMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.kind).toBe('place');
      if (m.kind === 'place') {
        expect(m.piece.type).toBe('queen');
        expect(m.piece.color).toBe('white');
      }
    }
    expect(() => placeMove(s, WS, { q: -3, r: 0 })).toThrow(IllegalMoveError);
  });
});

describe('applyMove: relocation rules', () => {
  it("rejects relocation before the player's queen is placed", () => {
    let s: GameState = createGame();
    s = placeMove(s, WA, ORIGIN);
    s = placeMove(s, BA, E);
    const tryMove: Move = { kind: 'relocate', from: ORIGIN, to: { q: 0, r: -1 } };
    expect(() => applyMove(s, tryMove)).toThrow(IllegalMoveError);
  });

  it('allows relocation once the active player has placed their queen', () => {
    let s: GameState = createGame();
    s = placeMove(s, WQ, ORIGIN);
    s = placeMove(s, BQ, E);
    const relocations = listValidMoves(s).filter((m) => m.kind === 'relocate');
    expect(relocations.length).toBeGreaterThan(0);
  });
});

describe('listValidMoves', () => {
  it('returns one place-move per piece type at origin on the very first move', () => {
    const moves = listValidMoves(createGame());
    expect(moves).toHaveLength(5);
    for (const m of moves) {
      expect(m.kind).toBe('place');
      if (m.kind === 'place') {
        expect(m.piece.color).toBe('white');
        expect(key(m.to)).toBe(key(ORIGIN));
      }
    }
  });
});

describe('applyMove: finished state rejects further moves', () => {
  it('throws when applyMove is called on a finished game', () => {
    // Reach a finished state via construction below (separate test), or
    // build a minimal finished state inline for this assertion.
    const finished: GameState = {
      status: 'finished',
      result: 'black-wins',
      board: fromCells([]),
      hands: {
        white: { queen: 0, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
        black: { queen: 0, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
      },
      currentPlayer: 'white',
      turnNumbers: { white: 1, black: 1 },
      history: [],
    };
    expect(() => applyMove(finished, { kind: 'pass' })).toThrow(IllegalMoveError);
  });
});

describe('applyMove: transitions to finished when a queen becomes surrounded', () => {
  it("recognizes black's surrounding move and ends the game", () => {
    // Hand-built state: white queen at origin with 5 of 6 neighbors filled.
    // Black ant at (1,1) is poised to slide into (0,1), completing the surround.
    // (1,1) is adjacent to (1,0)WA so the ant is connected to the hive;
    // sliding (1,1)→(0,1) has anchor at (1,0)WA and empty gap at (0,2).
    const board = fromCells([
      [ORIGIN, [WQ]],
      [{ q: 1, r: 0 }, [WA]],
      [{ q: 1, r: -1 }, [BB]],
      [{ q: 0, r: -1 }, [WA]],
      [{ q: -1, r: 0 }, [WA]],
      [{ q: -1, r: 1 }, [WA]],
      [{ q: 1, r: 1 }, [BA]],
      [{ q: 2, r: 0 }, [BQ]],
    ]);

    const state: GameState = {
      status: 'in_progress',
      board,
      hands: {
        white: { queen: 0, ant: 0, beetle: 2, spider: 2, grasshopper: 3 },
        black: { queen: 0, ant: 1, beetle: 1, spider: 2, grasshopper: 3 },
      },
      currentPlayer: 'black',
      turnNumbers: { white: 4, black: 4 },
      history: [],
    };

    const after = applyMove(state, {
      kind: 'relocate',
      from: { q: 1, r: 1 },
      to: { q: 0, r: 1 },
    });

    expect(after.status).toBe('finished');
    if (after.status === 'finished') {
      expect(after.result).toBe('black-wins');
    }
  });
});

describe('history grows with every applied move', () => {
  it('appends each move in order', () => {
    let s: GameState = createGame();
    s = placeMove(s, WA, ORIGIN);
    s = placeMove(s, BA, E);
    expect(s.history).toEqual([
      { kind: 'place', piece: WA, to: ORIGIN },
      { kind: 'place', piece: BA, to: E },
    ]);
  });
});
