import { describe, expect, it } from 'vitest';
import { empty, place } from './board.js';
import { type HexCoord, neighbors } from './hex.js';
import type { Piece } from './piece.js';
import { getResult, isQueenSurrounded } from './result.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const BQ: Piece = { type: 'queen', color: 'black' };
const WA: Piece = { type: 'ant', color: 'white' };
const BB: Piece = { type: 'beetle', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const FAR: HexCoord = { q: 10, r: 0 };

const placeAround = (b: ReturnType<typeof empty>, center: HexCoord, p: Piece) =>
  neighbors(center).reduce((acc, n) => place(acc, n, p), b);

describe('isQueenSurrounded', () => {
  it('returns false on an empty board', () => {
    expect(isQueenSurrounded(empty(), 'white')).toBe(false);
  });

  it('returns false when the queen is not on the board', () => {
    const b = place(empty(), ORIGIN, WA);
    expect(isQueenSurrounded(b, 'white')).toBe(false);
  });

  it('returns false when the queen has fewer than 6 neighbors occupied', () => {
    let b = place(empty(), ORIGIN, WQ);
    const ns = neighbors(ORIGIN).slice(0, 5);
    for (const n of ns) b = place(b, n, WA);
    expect(isQueenSurrounded(b, 'white')).toBe(false);
  });

  it('returns true when all 6 neighbors of the queen cell are occupied', () => {
    const b = placeAround(place(empty(), ORIGIN, WQ), ORIGIN, WA);
    expect(isQueenSurrounded(b, 'white')).toBe(true);
  });

  it('still returns true when the queen is under a beetle', () => {
    const stacked = place(place(empty(), ORIGIN, WQ), ORIGIN, BB);
    const b = placeAround(stacked, ORIGIN, WA);
    expect(isQueenSurrounded(b, 'white')).toBe(true);
  });

  it('counts a neighbor stack as occupied regardless of stack height', () => {
    let b = place(empty(), ORIGIN, WQ);
    const [first, ...rest] = neighbors(ORIGIN);
    if (!first) throw new Error('unreachable');
    // Stack two pieces on the first neighbor; single piece on the rest
    b = place(place(b, first, WA), first, BB);
    for (const n of rest) b = place(b, n, WA);
    expect(isQueenSurrounded(b, 'white')).toBe(true);
  });

  it('checks queens independently by color', () => {
    // White queen surrounded; black queen elsewhere alone.
    let b = placeAround(place(empty(), ORIGIN, WQ), ORIGIN, WA);
    b = place(b, FAR, BQ);
    expect(isQueenSurrounded(b, 'white')).toBe(true);
    expect(isQueenSurrounded(b, 'black')).toBe(false);
  });
});

describe('getResult', () => {
  it('returns ongoing on an empty board', () => {
    expect(getResult(empty())).toBe('ongoing');
  });

  it('returns ongoing when queens exist but none are surrounded', () => {
    const b = place(place(empty(), ORIGIN, WQ), FAR, BQ);
    expect(getResult(b)).toBe('ongoing');
  });

  it('returns black-wins when only the white queen is surrounded', () => {
    let b = placeAround(place(empty(), ORIGIN, WQ), ORIGIN, WA);
    b = place(b, FAR, BQ);
    expect(getResult(b)).toBe('black-wins');
  });

  it('returns white-wins when only the black queen is surrounded', () => {
    let b = placeAround(place(empty(), ORIGIN, BQ), ORIGIN, WA);
    b = place(b, FAR, WQ);
    expect(getResult(b)).toBe('white-wins');
  });

  it('returns draw when both queens are surrounded simultaneously', () => {
    const FAR2: HexCoord = { q: 20, r: 0 };
    let b = placeAround(place(empty(), ORIGIN, WQ), ORIGIN, WA);
    b = placeAround(place(b, FAR2, BQ), FAR2, WA);
    expect(getResult(b)).toBe('draw');
  });
});
