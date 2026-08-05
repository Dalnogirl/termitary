import { describe, expect, it } from 'vitest';
import { type HexCoord, key, neighbors, parse } from './hex.js';

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
