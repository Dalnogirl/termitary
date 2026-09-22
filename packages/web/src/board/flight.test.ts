import { type Board, type Piece, type PieceType, createGame } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import {
  CRAWL_MAX_MS,
  RELOCATE_MS,
  type Relocation,
  crawlPlanner,
  createFlightPath,
  liftPlanner,
  placeScaleAt,
} from './flight.js';
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
      pacing: 'arc',
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

const piece = (type: PieceType): Piece => ({ type, color: 'white' });

type Cell = readonly [{ readonly q: number; readonly r: number }, PieceType];

const boardOf = (...cells: readonly Cell[]): Board => ({
  cells: new Map(cells.map(([c, type]) => [`${c.q},${c.r}`, [piece(type)]])),
});

const line = (length: number, type: PieceType): Cell[] =>
  Array.from({ length }, (_, i) => [{ q: i + 1, r: 0 }, type] as const);

describe('crawlPlanner', () => {
  const ORIGIN = { q: 0, r: 0 };

  it('paces the route one cell at a time, settling in each', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    const path = createFlightPath({ points, lift: 0, pacing: 'step', durationMs: 270 });

    // Each third of the time covers exactly one cell, however the piece eases
    // inside it, which an arc-eased route does not do.
    expect(path.positionAt(0)).toEqual(points[0]);
    expect(path.positionAt(1 / 3)).toEqual(points[1]);
    expect(path.positionAt(2 / 3)).toEqual(points[2]);
    expect(path.positionAt(1)).toEqual(points[3]);

    // Slow at both ends of a step rather than fastest at the middle of the route.
    expect(path.positionAt(0.02).x).toBeLessThan(0.5);
    expect(path.positionAt(1 / 6).x).toBeCloseTo(5, 6);
  });

  it('follows the sliding route cell by cell, on the hive', () => {
    const board = boardOf([ORIGIN, 'ant'], [{ q: 1, r: 0 }, 'queen'], [{ q: 2, r: 0 }, 'spider']);
    const flight = crawlPlanner(relocate(ORIGIN, { q: 3, r: 0 }), board);
    expect(flight.lift).toBe(0);
    expect(flight.points).toEqual(
      [ORIGIN, { q: 1, r: -1 }, { q: 2, r: -1 }, { q: 3, r: -1 }, { q: 3, r: 0 }].map((c) =>
        axialToPixel(c, HEX_SIZE),
      ),
    );
  });

  it('scales the duration by step count, floored at a lift and capped', () => {
    const short = boardOf([ORIGIN, 'queen'], [{ q: 1, r: 0 }, 'ant']);
    expect(crawlPlanner(relocate(ORIGIN, { q: 1, r: -1 }), short).durationMs).toBe(RELOCATE_MS);

    const long = boardOf([ORIGIN, 'ant'], ...line(8, 'queen'));
    expect(crawlPlanner(relocate(ORIGIN, { q: 8, r: 1 }), long).durationMs).toBe(CRAWL_MAX_MS);
  });

  it('flies a grasshopper, which has no route to crawl', () => {
    const board = boardOf([ORIGIN, 'grasshopper'], [{ q: 1, r: 0 }, 'queen']);
    const move = relocate(ORIGIN, { q: 2, r: 0 });
    expect(crawlPlanner(move, board)).toEqual(liftPlanner(move, board));
  });

  it('flies a pillbug throw, where the moving piece is not the one deciding', () => {
    const board = boardOf([ORIGIN, 'pillbug'], [{ q: 1, r: 0 }, 'ant']);
    const move: Relocation = {
      kind: 'throw',
      by: ORIGIN,
      from: { q: 1, r: 0 },
      to: { q: 1, r: -1 },
    };
    expect(crawlPlanner(move, board)).toEqual(liftPlanner(move, board));
  });
});
