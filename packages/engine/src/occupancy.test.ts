import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { empty, place } from './board.js';
import type { HexCoord } from './hex.js';
import { canSlide } from './occupancy.js';
import type { Piece } from './piece.js';

const WA: Piece = { type: 'ant', color: 'white' };
const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const SE: HexCoord = { q: 0, r: 1 };

describe('canSlide', () => {
  it('returns true on an open board (both gates empty)', () => {
    expect(canSlide(empty(), ORIGIN, E)).toBe(true);
  });

  it('returns true when one gate is blocked', () => {
    const b = place(empty(), NE, WA);
    expect(canSlide(b, ORIGIN, E)).toBe(true);
  });

  it('returns false when both gates are blocked (squeezed)', () => {
    const b = place(place(empty(), NE, WA), SE, WA);
    expect(canSlide(b, ORIGIN, E)).toBe(false);
  });

  it('ignores occupancy at from and to themselves', () => {
    const b = place(place(empty(), ORIGIN, WA), E, WA);
    expect(canSlide(b, ORIGIN, E)).toBe(true);
  });

  it('returns false for far-apart coords (no shared neighbors)', () => {
    expect(canSlide(empty(), ORIGIN, { q: 5, r: 0 })).toBe(false);
  });

  it('property: symmetric in from/to', () => {
    const coordArb: fc.Arbitrary<HexCoord> = fc.record({
      q: fc.integer({ min: -3, max: 3 }),
      r: fc.integer({ min: -3, max: 3 }),
    });
    const blockerArb = fc.array(coordArb, { maxLength: 6 });
    fc.assert(
      fc.property(coordArb, coordArb, blockerArb, (from, to, blockers) => {
        let b = empty();
        for (const c of blockers) b = place(b, c, WA);
        expect(canSlide(b, from, to)).toBe(canSlide(b, to, from));
      }),
    );
  });
});
