import type { HexCoord } from '@termitary/engine';
import { axialToPixel } from '../board/hex.js';
import { HEX_DRAW_SIZE, HEX_RADIUS } from '../board/metrics.js';

// A real board position, not a drawing of hexagons: six tiles stacked one, two,
// three, on the lattice axialToPixel lays the board out on.
export const MOUND_CELLS: readonly HexCoord[] = [
  { q: 0, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: -2, r: 2 },
  { q: -1, r: 2 },
  { q: 0, r: 2 },
];

// Distance between lattice centre and tile edge, so a gap of 2 at size 40 is
// the board's own 40/38 pair.
export const MARK_GAP = 1.1;
// The tiles fuse below about 20px at MARK_GAP, and the mark reads as a rounded
// triangle. The icon cut opens the gaps enough to survive a 16px favicon.
export const ICON_GAP = 2.6;

const CORNER_RATIO = HEX_RADIUS / HEX_DRAW_SIZE;
const SQRT3 = Math.sqrt(3);

const round = (n: number): string => (Math.round(n * 1000) / 1000).toString();

const corners = (cx: number, cy: number, size: number): readonly (readonly [number, number])[] =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)] as const;
  });

// Where the corner arc leaves the straight side. traceHex rounds with arcTo, so
// the tangent length comes from the 120° interior angle: r / tan(60°).
const towards = (
  from: readonly [number, number],
  to: readonly [number, number],
  distance: number,
): readonly [number, number] => {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const len = Math.hypot(tx - fx, ty - fy);
  return [fx + ((tx - fx) / len) * distance, fy + ((ty - fy) / len) * distance];
};

const tilePath = (cx: number, cy: number, size: number): string => {
  const radius = size * CORNER_RATIO;
  const tangent = radius / SQRT3;
  const pts = corners(cx, cy, size);
  const segments: string[] = [];

  for (let i = 0; i < 6; i++) {
    const corner = pts[i] as readonly [number, number];
    const prev = pts[(i + 5) % 6] as readonly [number, number];
    const next = pts[(i + 1) % 6] as readonly [number, number];
    const entry = towards(corner, prev, tangent);
    const exit = towards(corner, next, tangent);
    segments.push(
      `${i === 0 ? 'M' : 'L'}${round(entry[0])} ${round(entry[1])}`,
      // Clockwise on screen, because y grows downward and the corners run 60° at a time.
      `A${round(radius)} ${round(radius)} 0 0 1 ${round(exit[0])} ${round(exit[1])}`,
    );
  }
  return `${segments.join('')}Z`;
};

export const moundPath = (size: number, gap: number): string =>
  MOUND_CELLS.map((cell) => {
    const p = axialToPixel(cell, size);
    return tilePath(p.x, p.y, size - gap);
  }).join('');

export const moundViewBox = (size: number, gap: number, pad = 0): string => {
  const tile = size - gap;
  const centers = MOUND_CELLS.map((cell) => axialToPixel(cell, size));
  const halfWidth = (SQRT3 / 2) * tile + pad;
  const xs = centers.map((p) => p.x);
  const ys = centers.map((p) => p.y);
  const minX = Math.min(...xs) - halfWidth;
  const minY = Math.min(...ys) - tile - pad;
  const width = Math.max(...xs) + halfWidth - minX;
  const height = Math.max(...ys) + tile + pad - minY;
  return `${round(minX)} ${round(minY)} ${round(width)} ${round(height)}`;
};
