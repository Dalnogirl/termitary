import type { HexCoord } from '@hive/engine';

export type Pixel = { readonly x: number; readonly y: number };

const SQRT3 = Math.sqrt(3);

export const axialToPixel = (c: HexCoord, size: number): Pixel => ({
  x: size * SQRT3 * (c.q + c.r / 2),
  y: size * 1.5 * c.r,
});

export const hexCorners = (center: Pixel, size: number): number[] => {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(center.x + size * Math.cos(angle));
    pts.push(center.y + size * Math.sin(angle));
  }
  return pts;
};
