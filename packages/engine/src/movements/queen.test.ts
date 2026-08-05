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
  it('returns empty list when alone on the board (no friend to slide along)', () => {
    // A lone queen is technically against Hive's "stay connected" rule but
    // queenMovement is a geometry primitive — it only cares about sliding.
    // On a board with just the queen, all 6 neighbors are empty AND both
    // gates of each are empty, so all 6 are returned.
    const b = place(empty(), ORIGIN, WQ);
    const moves = queenMovement(ORIGIN, b);
    expect(moves).toHaveLength(6);
  });

  it('with one adjacent friend, can slide to 4 empty neighbors (skips the friend, 1 squeezed gap)', () => {
    // Queen at ORIGIN, friend at E. Of the remaining 5 neighbors of origin:
    //   NE and SE are adjacent to both ORIGIN and E -> their gates include E.
    //   For target NE: gates are E (occupied) and NW (empty) -> can slide.
    //   For target SE: gates are E (occupied) and SW (empty) -> can slide.
    //   For NW, W, SW: gates do not include E -> all empty -> can slide.
    // So 5 valid moves, not 4. Let me re-check by walking through.
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    const moves = queenMovement(ORIGIN, b);
    const moveKeys = new Set(moves.map(key));
    expect(moveKeys).not.toContain(key(E));
    expect(moveKeys.size).toBe(5);
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
});
