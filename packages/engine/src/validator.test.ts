import { describe, expect, it } from 'vitest';
import { empty, place } from './board.js';
import { type HexCoord, key, neighbors } from './hex.js';
import type { Piece } from './piece.js';
import { getValidMoves } from './validator.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const BQ: Piece = { type: 'queen', color: 'black' };
const WA: Piece = { type: 'ant', color: 'white' };
const BB: Piece = { type: 'beetle', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const EE: HexCoord = { q: 2, r: 0 };

describe('getValidMoves', () => {
  it('returns queen geometric moves on an open two-piece board', () => {
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    const moves = getValidMoves(WQ, ORIGIN, b);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.map(key)).not.toContain(key(E));
  });

  it('returns [] when queen is at an articulation point (one-hive blocks)', () => {
    // line: ant - queen - ant; removing queen disconnects
    const b = place(place(place(empty(), ORIGIN, WA), E, WQ), EE, WA);
    expect(getValidMoves(WQ, E, b)).toEqual([]);
  });

  it('returns [] when queen is pinned by a beetle (top of stack mismatch)', () => {
    const b = place(place(place(empty(), ORIGIN, WQ), ORIGIN, BB), E, WA);
    expect(getValidMoves(WQ, ORIGIN, b)).toEqual([]);
  });

  it('returns [] when the piece at from does not match by type', () => {
    const b = place(place(empty(), ORIGIN, WA), E, WA);
    expect(getValidMoves(WQ, ORIGIN, b)).toEqual([]);
  });

  it('returns [] when the piece at from does not match by color', () => {
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    expect(getValidMoves(BQ, ORIGIN, b)).toEqual([]);
  });

  it('returns [] when from is empty', () => {
    const b = place(empty(), E, WA);
    expect(getValidMoves(WQ, ORIGIN, b)).toEqual([]);
  });

  it('queen with one adjacent friend: only destinations touching the friend in transit', () => {
    // Queen at ORIGIN, friend at E. After removing the queen, the only neighbors
    // of ORIGIN still adjacent to the friend are NE (1,-1) and SE (0,1).
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    const moves = new Set(getValidMoves(WQ, ORIGIN, b).map(key));
    expect(moves.has(key(E))).toBe(false);
    expect(moves.size).toBe(2);
  });

  it('ant has movement now (not a fallback case)', () => {
    // Replaces the prior "unimplemented piece" test — ant is now implemented.
    // Smoke test that getValidMoves returns at least one ant move.
    const b = place(place(empty(), ORIGIN, WA), E, { type: 'queen', color: 'white' });
    expect(getValidMoves(WA, ORIGIN, b).length).toBeGreaterThan(0);
  });

  it('every returned move is among the 6 axial neighbors of from (queen invariant)', () => {
    const b = place(place(empty(), ORIGIN, WQ), E, WA);
    const moves = getValidMoves(WQ, ORIGIN, b);
    const validTargets = new Set(neighbors(ORIGIN).map(key));
    for (const m of moves) expect(validTargets.has(key(m))).toBe(true);
  });
});
