import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { empty, isEmpty, place } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece } from '../piece.js';
import { grasshopperMovement } from './grasshopper.js';

const WG: Piece = { type: 'grasshopper', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E1: HexCoord = { q: 1, r: 0 };
const E2: HexCoord = { q: 2, r: 0 };
const E3: HexCoord = { q: 3, r: 0 };
const W1: HexCoord = { q: -1, r: 0 };

describe('grasshopperMovement', () => {
  it('returns [] when grasshopper has no occupied neighbors (no jump possible)', () => {
    const b = place(empty(), ORIGIN, WG);
    expect(grasshopperMovement(ORIGIN, b)).toEqual([]);
  });

  it('jumps over a single occupied neighbor and lands beyond it', () => {
    const b = place(place(empty(), ORIGIN, WG), E1, WA);
    const moves = grasshopperMovement(ORIGIN, b);
    expect(moves.map(key)).toEqual([key(E2)]);
  });

  it('jumps over a chain of 3 and lands on first empty', () => {
    const b = [
      [E1, WA],
      [E2, WA],
      [E3, WA],
    ].reduce((acc, [c, p]) => place(acc, c as HexCoord, p as Piece), place(empty(), ORIGIN, WG));
    const moves = grasshopperMovement(ORIGIN, b);
    expect(moves.map(key)).toContain('4,0');
    expect(moves).toHaveLength(1);
  });

  it('produces one destination per direction that starts with an occupied neighbor', () => {
    const b = place(place(place(empty(), ORIGIN, WG), E1, WA), W1, WA);
    const moves = grasshopperMovement(ORIGIN, b);
    expect(moves).toHaveLength(2);
    const keys = moves.map(key);
    expect(keys).toContain(key(E2));
    expect(keys).toContain('-2,0');
  });

  it('skips directions whose first neighbor is empty (no piece to jump over)', () => {
    const b = place(place(empty(), ORIGIN, WG), E2, WA);
    // E1 (the first neighbor in that direction) is empty -> no jump in this direction
    expect(grasshopperMovement(ORIGIN, b)).toEqual([]);
  });

  it('property: every returned target is empty', () => {
    const coordArb: fc.Arbitrary<HexCoord> = fc.record({
      q: fc.integer({ min: -3, max: 3 }),
      r: fc.integer({ min: -3, max: 3 }),
    });
    fc.assert(
      fc.property(fc.array(coordArb, { maxLength: 10 }), (placements) => {
        let b = place(empty(), ORIGIN, WG);
        for (const c of placements) {
          if (c.q !== 0 || c.r !== 0) b = place(b, c, WA);
        }
        for (const target of grasshopperMovement(ORIGIN, b)) {
          expect(isEmpty(b, target)).toBe(true);
        }
      }),
    );
  });

  it('jump destinations are colinear with grasshopper (smoke test for direction walking)', () => {
    const b = place(place(empty(), ORIGIN, WG), E1, WA);
    const moves = grasshopperMovement(ORIGIN, b);
    // E2 is colinear with E1 from ORIGIN (same direction)
    const dirOfE1 = { q: E1.q - ORIGIN.q, r: E1.r - ORIGIN.r };
    for (const m of moves) {
      // m = ORIGIN + k * dirOfE1 for some positive integer k
      const k = m.q !== 0 ? m.q / dirOfE1.q : m.r / dirOfE1.r;
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(2);
    }
  });
});
