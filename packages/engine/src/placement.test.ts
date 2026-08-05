import { describe, expect, it } from 'vitest';
import { empty, place } from './board.js';
import { type HexCoord, key } from './hex.js';
import type { Piece } from './piece.js';
import { getValidPlacementCoords } from './placement.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const BA: Piece = { type: 'ant', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };

describe('getValidPlacementCoords', () => {
  it('white turn 0 returns only the origin', () => {
    const placements = getValidPlacementCoords(empty(), 'white', 0);
    expect(placements.map(key)).toEqual([key(ORIGIN)]);
  });

  it("black turn 0 returns the 6 cells adjacent to white's opening piece", () => {
    const b = place(empty(), ORIGIN, WQ);
    const placements = getValidPlacementCoords(b, 'black', 0);
    expect(placements).toHaveLength(6);
  });

  it('from turn 1 onward, white must touch white and not black', () => {
    // White at origin, black at E. White is placing their 2nd piece.
    const b = place(place(empty(), ORIGIN, WQ), E, BA);
    const placements = getValidPlacementCoords(b, 'white', 1);
    const placementKeys = new Set(placements.map(key));
    expect(placementKeys).toEqual(
      new Set([key({ q: 0, r: -1 }), key({ q: -1, r: 0 }), key({ q: -1, r: 1 })]),
    );
  });

  it('from turn 1 onward, black must touch black and not white', () => {
    const b = place(place(empty(), ORIGIN, WQ), E, BA);
    const placements = getValidPlacementCoords(b, 'black', 1);
    const placementKeys = new Set(placements.map(key));
    expect(placementKeys).toEqual(
      new Set([key({ q: 2, r: 0 }), key({ q: 2, r: -1 }), key({ q: 1, r: 1 })]),
    );
  });

  it('returns no placements for non-zero turn when player has no pieces on board', () => {
    // Defensive: a "black turn 1" against an empty board is degenerate.
    expect(getValidPlacementCoords(empty(), 'black', 1)).toEqual([]);
  });

  it('does not include cells already occupied', () => {
    const b = place(empty(), ORIGIN, WQ);
    const placements = getValidPlacementCoords(b, 'black', 0);
    expect(placements.map(key)).not.toContain(key(ORIGIN));
  });
});
