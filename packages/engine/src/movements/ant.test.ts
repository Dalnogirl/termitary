import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { empty, isEmpty, place, remove } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece } from '../piece.js';
import { antMovement } from './ant.js';
import { hasOccupiedNeighbor } from './utils.js';

const WA: Piece = { type: 'ant', color: 'white' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const EE: HexCoord = { q: 2, r: 0 };

describe('antMovement', () => {
  it('returns [] when alone on the board', () => {
    const b = place(empty(), ORIGIN, WA);
    expect(antMovement(ORIGIN, b)).toEqual([]);
  });

  it('with one adjacent friend, reaches all 5 boundary cells around the friend', () => {
    // Ant at ORIGIN (0,0), friend at E (1,0). The ant can crawl all the way
    // around the friend, reaching every empty cell adjacent to E (except the
    // starting cell at ORIGIN).
    const b = place(place(empty(), ORIGIN, WA), E, WA);
    const moves = new Set(antMovement(ORIGIN, b).map(key));
    const expected = new Set(['1,-1', '2,-1', '2,0', '1,1', '0,1']);
    expect(moves).toEqual(expected);
  });

  it('reaches cells on both ends of a line by walking around', () => {
    // Pieces at (1,0) and (2,0). Ant at origin. Ant should be able to crawl
    // all the way around the 2-piece line to the far side.
    const b = [
      [E, WA],
      [EE, WA],
    ].reduce((acc, [c, p]) => place(acc, c as HexCoord, p as Piece), place(empty(), ORIGIN, WA));
    const moves = new Set(antMovement(ORIGIN, b).map(key));
    // Far side of the line: (3, 0), (3, -1), (2, 1), etc. should all be reachable.
    expect(moves.has('3,0')).toBe(true);
    expect(moves.has('3,-1')).toBe(true);
    expect(moves.has('2,1')).toBe(true);
  });

  it('does not return the starting cell', () => {
    const b = place(place(empty(), ORIGIN, WA), E, WA);
    expect(antMovement(ORIGIN, b).map(key)).not.toContain(key(ORIGIN));
  });

  it('property: every returned target is empty and touches the hive in transit', () => {
    const coordArb: fc.Arbitrary<HexCoord> = fc.record({
      q: fc.integer({ min: -3, max: 3 }),
      r: fc.integer({ min: -3, max: 3 }),
    });
    fc.assert(
      fc.property(coordArb, fc.array(coordArb, { maxLength: 6 }), (extra, others) => {
        // Always include the ant's starting friend so the hive is non-empty.
        let b = place(place(empty(), ORIGIN, WA), NE, WA);
        for (const c of others) {
          if (c.q !== ORIGIN.q || c.r !== ORIGIN.r) b = place(b, c, WA);
        }
        if (extra.q !== ORIGIN.q || extra.r !== ORIGIN.r) b = place(b, extra, WA);
        const transit = remove(b, ORIGIN);
        for (const m of antMovement(ORIGIN, b)) {
          expect(isEmpty(transit, m)).toBe(true);
          expect(hasOccupiedNeighbor(transit, m)).toBe(true);
        }
      }),
    );
  });
});
