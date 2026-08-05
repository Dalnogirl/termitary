import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key, neighbors } from '../hex.js';
import type { Piece } from '../piece.js';
import { queenMovement } from './queen.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };
const BB: Piece = { type: 'beetle', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const NW: HexCoord = { q: 0, r: -1 };
const W: HexCoord = { q: -1, r: 0 };
const SW: HexCoord = { q: -1, r: 1 };
const SE: HexCoord = { q: 0, r: 1 };

describe('queenMovement', () => {
  it('returns [] when alone on the board (no hive to touch)', () => {
    // Touching-hive rule: every move must end adjacent to at least one
    // other occupied cell. A lone queen has no friends, so no moves.
    const b = place(empty(), ORIGIN, WQ);
    expect(queenMovement(ORIGIN, b)).toEqual([]);
  });

  it('returns no moves when squeezed: gap between two adjacent friends', () => {
    // Queen at ORIGIN, friends at NE and SE.
    // Target E: gates are NE (occupied) and SE (occupied) -> squeezed.
    // Targets NW, W, SW, NE-itself, SE-itself: NE and SE are occupied so not destinations.
    // Targets NW, W, SW are reachable depending on their gates.
    //   NW: gates are NE (occupied) and W (empty) -> can slide.
    //   W:  gates are NW (empty) and SW (empty) -> can slide.
    //   SW: gates are W (empty) and SE (occupied) -> can slide.
    // So 3 moves available, E is the squeezed one.
    const b = place(place(place(empty(), ORIGIN, WQ), NE, WA), SE, WA);
    const moves = queenMovement(ORIGIN, b);
    const moveKeys = new Set(moves.map(key));
    expect(moveKeys).not.toContain(key(E));
    expect(moveKeys).not.toContain(key(NE));
    expect(moveKeys).not.toContain(key(SE));
  });

  it('returns empty list when fully surrounded', () => {
    let b = place(empty(), ORIGIN, WQ);
    for (const n of neighbors(ORIGIN)) b = place(b, n, WA);
    expect(queenMovement(ORIGIN, b)).toEqual([]);
  });

  it('does not include destinations that are occupied', () => {
    const b = place(place(empty(), ORIGIN, WQ), E, BB);
    const moves = queenMovement(ORIGIN, b);
    expect(moves.map(key)).not.toContain(key(E));
  });

  it('never returns the origin itself', () => {
    const b = place(empty(), ORIGIN, WQ);
    expect(queenMovement(ORIGIN, b).map(key)).not.toContain(key(ORIGIN));
  });

  // --- Touching-hive rule regression tests (TDD: failing before the fix) ---

  it('does not return destinations that would dangle the queen from the rest of the hive', () => {
    // Queen at ORIGIN with a single friend at NE. If queen moves to SW, the
    // friend at NE is no longer adjacent to anything — hive splits into two
    // components. Such a destination must be rejected.
    const b = place(place(empty(), ORIGIN, WQ), NE, WA);
    const moves = queenMovement(ORIGIN, b);
    expect(moves.map(key)).not.toContain(key(SW));
    expect(moves.map(key)).not.toContain(key(W));
  });

  it('with one adjacent friend, only destinations adjacent to that friend (in transit) are valid', () => {
    // Queen at ORIGIN, friend at E. After removing the queen, only NE and SE
    // are adjacent to E. Other neighbors of ORIGIN would dangle.
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    const moves = new Set(queenMovement(ORIGIN, b).map(key));
    expect(moves).toEqual(new Set([key(NE), key(SE)]));
  });
});
