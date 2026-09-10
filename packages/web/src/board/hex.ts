import type { HexCoord } from '@hive/engine';
import { Shape, type ShapeConfig } from 'konva/lib/Shape.js';

export type Pixel = { readonly x: number; readonly y: number };

const SQRT3 = Math.sqrt(3);

export const axialToPixel = (c: HexCoord, size: number): Pixel => ({
  x: size * SQRT3 * (c.q + c.r / 2),
  y: size * 1.5 * c.r,
});

// Konva's Context and CanvasRenderingContext2D both satisfy this, which is how
// the board and the static clusters trace the identical outline.
export type HexPathSink = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void;
  closePath: () => void;
};

const hexCornerPoints = (center: Pixel, size: number): readonly Pixel[] => {
  const pts: Pixel[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return pts;
};

export const traceHex = (
  ctx: HexPathSink,
  center: Pixel,
  size: number,
  cornerRadius: number,
): void => {
  const corners = hexCornerPoints(center, size);
  const c0 = corners[0];
  const c5 = corners[5];
  if (!c0 || !c5) return;
  ctx.beginPath();
  ctx.moveTo((c5.x + c0.x) / 2, (c5.y + c0.y) / 2);
  for (let i = 0; i < 6; i++) {
    const corner = corners[i];
    const next = corners[(i + 1) % 6];
    if (!corner || !next) continue;
    const midNext = { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 };
    ctx.arcTo(corner.x, corner.y, midNext.x, midNext.y, cornerRadius);
  }
  ctx.closePath();
};

export const createHexShape = (
  center: Pixel,
  size: number,
  cornerRadius: number,
  attrs: ShapeConfig,
): Shape =>
  new Shape({
    ...attrs,
    sceneFunc: (ctx, shape) => {
      traceHex(ctx, center, size, cornerRadius);
      ctx.fillStrokeShape(shape);
    },
  });

// Perimeter of the outline traceHex draws: six sides, each shortened by the
// tangent length the corner arcs eat, plus the arcs. The corners turn 60°, so
// together they come to one full circle.
export const hexPerimeter = (size: number, cornerRadius: number): number =>
  6 * size - 4 * Math.sqrt(3) * cornerRadius + 2 * Math.PI * cornerRadius;

export type HexDash = {
  readonly pattern: readonly [number, number];
  readonly offset: number;
};

// A dash pattern that does not divide the perimeter leaves a seam where the
// path closes, and drifts out of phase so no two sides match. Scaling it to a
// multiple of six makes every side identical, and the half-dash offset centres
// a dash on each side midpoint and each corner.
export const hexDash = (size: number, cornerRadius: number, dash: number, gap: number): HexDash => {
  const perimeter = hexPerimeter(size, cornerRadius);
  const repeats = Math.max(6, Math.round(perimeter / (dash + gap) / 6) * 6);
  const scale = perimeter / (repeats * (dash + gap));
  return { pattern: [dash * scale, gap * scale], offset: (dash * scale) / 2 };
};
