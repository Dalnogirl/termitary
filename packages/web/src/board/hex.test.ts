import type { HexCoord } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { type Pixel, axialToPixel, sharedEdge } from './hex.js';

const SIZE = 40;

const NEIGHBOR_OFFSETS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const distance = (a: Pixel, b: Pixel): number => Math.hypot(a.x - b.x, a.y - b.y);

const corners = (center: Pixel): Pixel[] =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return { x: center.x + SIZE * Math.cos(angle), y: center.y + SIZE * Math.sin(angle) };
  });

const isCornerOf = (p: Pixel, center: Pixel): boolean =>
  corners(center).some((c) => distance(c, p) < 1e-9);

describe('sharedEdge', () => {
  const from = { q: 2, r: -1 };

  it.each(NEIGHBOR_OFFSETS)('returns two corners of both cells for neighbour %o', (offset) => {
    const to = { q: from.q + offset.q, r: from.r + offset.r };
    const edge = sharedEdge(from, to, SIZE);
    expect(edge).not.toBeNull();
    for (const p of edge ?? []) {
      expect(isCornerOf(p, axialToPixel(from, SIZE))).toBe(true);
      expect(isCornerOf(p, axialToPixel(to, SIZE))).toBe(true);
    }
  });

  it('spans one side of the hex', () => {
    const [a, b] = sharedEdge(from, { q: 3, r: -1 }, SIZE) ?? [];
    expect(a && b && distance(a, b)).toBeCloseTo(SIZE);
  });

  it('is the same side whichever cell comes first', () => {
    const to = { q: 2, r: 0 };
    const there = sharedEdge(from, to, SIZE) ?? [];
    const back = sharedEdge(to, from, SIZE) ?? [];
    expect(back).toHaveLength(2);
    for (const p of back) expect(there.some((q) => distance(p, q) < 1e-9)).toBe(true);
  });

  it.each([
    ['the same cell', { q: 2, r: -1 }],
    ['two steps away', { q: 4, r: -1 }],
    ['a diagonal that skips a cell', { q: 3, r: 0 }],
  ])('returns null for %s', (_, to) => {
    expect(sharedEdge(from, to, SIZE)).toBeNull();
  });
});
