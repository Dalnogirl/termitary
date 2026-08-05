import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { empty, place } from './board.js';
import type { HexCoord } from './hex.js';
import { canSlide, isConnectedWithout } from './occupancy.js';
import type { Piece } from './piece.js';

const WA: Piece = { type: 'ant', color: 'white' };
const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const SE: HexCoord = { q: 0, r: 1 };

describe('canSlide', () => {
  it('returns false on an open board: no anchor piece to slide along', () => {
    expect(canSlide(empty(), ORIGIN, E)).toBe(false);
  });

  it('returns true when exactly one gate is occupied (the anchor) and one is empty', () => {
    const b = place(empty(), NE, WA);
    expect(canSlide(b, ORIGIN, E)).toBe(true);
  });

  it('returns false when both gates are blocked (squeezed)', () => {
    const b = place(place(empty(), NE, WA), SE, WA);
    expect(canSlide(b, ORIGIN, E)).toBe(false);
  });

  it('ignores occupancy at from and to themselves; anchor still required at a gate', () => {
    const occupiedEnds = place(place(empty(), ORIGIN, WA), E, WA);
    // Both gates still empty → no anchor → cannot slide
    expect(canSlide(occupiedEnds, ORIGIN, E)).toBe(false);
    // Add anchor at NE → slide becomes valid
    const withAnchor = place(occupiedEnds, NE, WA);
    expect(canSlide(withAnchor, ORIGIN, E)).toBe(true);
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

describe('isConnectedWithout', () => {
  const C0: HexCoord = { q: 0, r: 0 };
  const E: HexCoord = { q: 1, r: 0 };
  const EE: HexCoord = { q: 2, r: 0 };
  const NE: HexCoord = { q: 1, r: -1 };

  it('returns true on an empty board', () => {
    expect(isConnectedWithout(empty(), C0)).toBe(true);
  });

  it('returns true when c is the only occupied cell (remaining vacuously connected)', () => {
    const b = place(empty(), C0, WA);
    expect(isConnectedWithout(b, C0)).toBe(true);
  });

  it('returns true when removing one of two adjacent pieces', () => {
    const b = place(place(empty(), C0, WA), E, WA);
    expect(isConnectedWithout(b, C0)).toBe(true);
  });

  it('returns false when removing the middle of a line-of-3 (articulation point)', () => {
    const b = place(place(place(empty(), C0, WA), E, WA), EE, WA);
    expect(isConnectedWithout(b, E)).toBe(false);
  });

  it('returns true when removing the end of a line-of-3', () => {
    const b = place(place(place(empty(), C0, WA), E, WA), EE, WA);
    expect(isConnectedWithout(b, EE)).toBe(true);
  });

  it('returns true when removing any vertex of a triangle (no articulation)', () => {
    const b = place(place(place(empty(), C0, WA), E, WA), NE, WA);
    expect(isConnectedWithout(b, C0)).toBe(true);
    expect(isConnectedWithout(b, E)).toBe(true);
    expect(isConnectedWithout(b, NE)).toBe(true);
  });

  it('short-circuits to true when the stack at c has more than one piece', () => {
    // queen+beetle stack at C0, lone piece at far-away (3,0) — would otherwise be disconnected
    const FAR: HexCoord = { q: 3, r: 0 };
    const b = place(place(place(empty(), C0, WA), C0, WA), FAR, WA);
    expect(isConnectedWithout(b, C0)).toBe(true);
  });

  it('property: stack length > 1 always returns true regardless of board shape', () => {
    const coordArb: fc.Arbitrary<HexCoord> = fc.record({
      q: fc.integer({ min: -3, max: 3 }),
      r: fc.integer({ min: -3, max: 3 }),
    });
    fc.assert(
      fc.property(coordArb, fc.array(coordArb, { maxLength: 8 }), (target, others) => {
        // place target twice (stack=2), then add other pieces anywhere
        let b = place(place(empty(), target, WA), target, WA);
        for (const o of others) b = place(b, o, WA);
        expect(isConnectedWithout(b, target)).toBe(true);
      }),
    );
  });
});
