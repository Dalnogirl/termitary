import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece } from '../piece.js';
import { beetleMovement } from './beetle.js';

const WB: Piece = { type: 'beetle', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const SE: HexCoord = { q: 0, r: 1 };

describe('beetleMovement', () => {
  it('alone on board: all 6 neighbors are reachable', () => {
    const b = place(empty(), ORIGIN, WB);
    expect(beetleMovement(ORIGIN, b)).toHaveLength(6);
  });

  it('climbs onto an adjacent friend (occupied target is allowed)', () => {
    const b = place(place(empty(), ORIGIN, WB), E, WA);
    const moves = beetleMovement(ORIGIN, b);
    expect(moves.map(key)).toContain(key(E));
  });

  it('squeezed at ground level (both gates occupied at height 1)', () => {
    // Beetle at origin (height 1), target E (empty), gates NE and SE both occupied at h=1
    const b = place(place(place(empty(), ORIGIN, WB), NE, WA), SE, WA);
    const moves = beetleMovement(ORIGIN, b);
    expect(moves.map(key)).not.toContain(key(E));
  });

  it('on top of a stack: descends to all 6 neighbors regardless of canSlide', () => {
    // Beetle on top of an ant at ORIGIN (stack height 2). With two ground-level
    // friends at NE and SE, the ground-only squeeze check would block E, but
    // beetle is climbing/descending — squeeze is bypassed.
    const b = place(place(place(place(empty(), ORIGIN, WA), ORIGIN, WB), NE, WA), SE, WA);
    const moves = beetleMovement(ORIGIN, b);
    expect(moves).toHaveLength(6);
    expect(moves.map(key)).toContain(key(E));
  });

  it('returns moves at ground level when only one gate is blocked', () => {
    const b = place(place(empty(), ORIGIN, WB), NE, WA);
    const moves = beetleMovement(ORIGIN, b);
    // E is reachable (one gate empty); NE is reachable (climbing onto WA)
    expect(moves.map(key)).toContain(key(E));
    expect(moves.map(key)).toContain(key(NE));
  });
});
