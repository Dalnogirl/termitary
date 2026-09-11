import { createGame } from '@hive/engine';
import { describe, expect, it } from 'vitest';
import { type Relocation, createFlightPath, liftPlanner, placeScaleAt } from './flight.js';
import { axialToPixel } from './hex.js';
import { HEX_SIZE } from './metrics.js';

const relocate = (from: { q: number; r: number }, to: { q: number; r: number }): Relocation => ({
  kind: 'relocate',
  from,
  to,
});

describe('createFlightPath', () => {
  const flight = liftPlanner(relocate({ q: 0, r: 0 }, { q: 3, r: 0 }), createGame().board);
  const path = createFlightPath(flight);

  it('starts on the origin cell and ends on the destination', () => {
    expect(path.positionAt(0)).toEqual(axialToPixel({ q: 0, r: 0 }, HEX_SIZE));
    expect(path.positionAt(1)).toEqual(axialToPixel({ q: 3, r: 0 }, HEX_SIZE));
  });

  it('walks a multi-point line in order, without going backwards', () => {
    const eight = createFlightPath({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 40, y: 10 },
      ],
      lift: 0,
      durationMs: 240,
    });
    const xs = [0, 0.25, 0.5, 0.75, 1].map((t) => eight.positionAt(t).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(eight.positionAt(1)).toEqual({ x: 40, y: 10 });
  });

  it('is full size at both ends and larger in the middle', () => {
    expect(path.scaleAt(0)).toBe(1);
    expect(path.scaleAt(1)).toBe(1);
    expect(path.scaleAt(0.5)).toBeCloseTo(1.15);
  });
});

describe('placeScaleAt', () => {
  it('grows from 0.7 to full size', () => {
    expect(placeScaleAt(0)).toBeCloseTo(0.7);
    expect(placeScaleAt(1)).toBe(1);
  });
});
