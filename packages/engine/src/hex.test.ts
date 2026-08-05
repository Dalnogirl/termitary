import { describe, expect, it } from 'vitest';
import { type HexCoord, key, neighbors, parse, sharedNeighbors } from './hex.js';

describe('key', () => {
  it('serializes origin', () => {
    expect(key({ q: 0, r: 0 })).toBe('0,0');
  });

  it('serializes negative coords', () => {
    expect(key({ q: -3, r: 5 })).toBe('-3,5');
  });

  it('is stable for equal inputs', () => {
    expect(key({ q: 2, r: -1 })).toBe(key({ q: 2, r: -1 }));
  });

  it('distinguishes different coords', () => {
    expect(key({ q: 1, r: 0 })).not.toBe(key({ q: 0, r: 1 }));
  });
});

describe('neighbors', () => {
  it('returns 6 neighbors at the origin', () => {
    const result = neighbors({ q: 0, r: 0 });
    expect(result).toHaveLength(6);
    expect(new Set(result.map(key))).toEqual(
      new Set(['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']),
    );
  });

  it('returns 6 distinct neighbors for any coord', () => {
    const c: HexCoord = { q: 7, r: -4 };
    const result = neighbors(c);
    expect(new Set(result.map(key)).size).toBe(6);
  });

  it('offsets relative to the input', () => {
    const c: HexCoord = { q: 10, r: 10 };
    const result = neighbors(c).map(key);
    expect(result).toContain('11,10');
    expect(result).toContain('9,10');
    expect(result).toContain('10,9');
    expect(result).toContain('10,11');
  });

  it('is symmetric: n in neighbors(c) <=> c in neighbors(n)', () => {
    const samples: HexCoord[] = [
      { q: 0, r: 0 },
      { q: 3, r: -2 },
      { q: -5, r: 5 },
      { q: 100, r: -100 },
    ];
    for (const c of samples) {
      for (const n of neighbors(c)) {
        const back = neighbors(n).map(key);
        expect(back).toContain(key(c));
      }
    }
  });

  it('does not include the input itself', () => {
    const c: HexCoord = { q: 4, r: 4 };
    expect(neighbors(c).map(key)).not.toContain(key(c));
  });
});

describe('parse', () => {
  it('inverts key for non-negative coords', () => {
    expect(parse('0,0')).toEqual({ q: 0, r: 0 });
    expect(parse('3,5')).toEqual({ q: 3, r: 5 });
  });

  it('inverts key for negative coords', () => {
    expect(parse('-3,5')).toEqual({ q: -3, r: 5 });
    expect(parse('-7,-2')).toEqual({ q: -7, r: -2 });
  });

  it('round-trips through key', () => {
    for (const c of [
      { q: 0, r: 0 },
      { q: 12, r: -7 },
      { q: -100, r: 100 },
    ]) {
      expect(parse(key(c))).toEqual(c);
    }
  });
});

describe('sharedNeighbors', () => {
  it('returns 2 cells for adjacent hexes', () => {
    const a: HexCoord = { q: 0, r: 0 };
    const b: HexCoord = { q: 1, r: 0 };
    const result = sharedNeighbors(a, b);
    expect(result).toHaveLength(2);
    expect(new Set(result.map(key))).toEqual(new Set(['1,-1', '0,1']));
  });

  it('returns 1 cell for hexes at axial distance 2', () => {
    const a: HexCoord = { q: 0, r: 0 };
    const b: HexCoord = { q: 2, r: 0 };
    const result = sharedNeighbors(a, b);
    expect(result).toHaveLength(1);
    expect(result.map(key)).toEqual(['1,0']);
  });

  it('returns 0 cells for hexes at distance 3+', () => {
    expect(sharedNeighbors({ q: 0, r: 0 }, { q: 3, r: 0 })).toEqual([]);
    expect(sharedNeighbors({ q: 0, r: 0 }, { q: 5, r: -5 })).toEqual([]);
  });

  it('returns 6 cells for identical inputs', () => {
    const result = sharedNeighbors({ q: 0, r: 0 }, { q: 0, r: 0 });
    expect(result).toHaveLength(6);
  });

  it('all 6 neighbors of origin share exactly 2 cells with origin (adjacency)', () => {
    for (const n of neighbors({ q: 0, r: 0 })) {
      expect(sharedNeighbors({ q: 0, r: 0 }, n)).toHaveLength(2);
    }
  });

  it('straight-line distance-2 pairs share exactly 1 cell', () => {
    for (const b of [
      { q: 2, r: 0 },
      { q: 0, r: 2 },
      { q: 2, r: -2 },
      { q: -2, r: 0 },
      { q: 0, r: -2 },
      { q: -2, r: 2 },
    ]) {
      expect(sharedNeighbors({ q: 0, r: 0 }, b)).toHaveLength(1);
    }
  });

  it('bent distance-2 pairs share 2 cells (geometry artifact)', () => {
    for (const b of [
      { q: 2, r: -1 },
      { q: 1, r: 1 },
      { q: -1, r: -1 },
      { q: -2, r: 1 },
    ]) {
      expect(sharedNeighbors({ q: 0, r: 0 }, b)).toHaveLength(2);
    }
  });

  it('property: symmetric in a/b', () => {
    for (const b of [
      { q: 1, r: 0 },
      { q: 2, r: -1 },
      { q: 3, r: 0 },
      { q: -5, r: 2 },
    ]) {
      const ab = new Set(sharedNeighbors({ q: 0, r: 0 }, b).map(key));
      const ba = new Set(sharedNeighbors(b, { q: 0, r: 0 }).map(key));
      expect(ab).toEqual(ba);
    }
  });
});
