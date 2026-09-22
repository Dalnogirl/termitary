import { type Board, type Move, slidePath } from '@termitary/engine';
import { type Pixel, axialToPixel } from './hex.js';
import { HEX_SIZE } from './metrics.js';

export type Relocation = Extract<Move, { kind: 'relocate' | 'throw' }>;

export type Flight = {
  /** At least two points, in layer coordinates. */
  readonly points: readonly Pixel[];
  /** 0 stays on the hive, 1 is a full pick-up. */
  readonly lift: number;
  /**
   * `'arc'` eases the whole route as one travel. `'step'` gives every segment
   * an equal slice of the time and eases it on its own, so a piece settles into
   * each cell before leaving it.
   */
  readonly pacing: 'arc' | 'step';
  readonly durationMs: number;
};

export type FlightPlanner = (move: Relocation, board: Board) => Flight;

// Under 180 reads as a jump cut. Over 350 makes the game feel slow once you are
// forty moves in, and every move pays it.
export const RELOCATE_MS = 240;
export const PLACE_MS = 140;

export const CRAWL_STEP_MS = 90;
// An ant crossing a large hive would otherwise animate for close to two
// seconds, which is charming once and irritating by move thirty.
export const CRAWL_MAX_MS = 700;

const LIFT_SCALE = 0.15;
// Fraction of the flight spent rising, and again settling.
const LIFT_RAMP = 0.2;

/**
 * Straight over the hive, rising and settling at the ends. It is what a hand
 * does with a real tile, and it avoids claiming a route the engine never
 * decided on. Every piece flies this way, the grasshopper included.
 */
export const liftPlanner: FlightPlanner = (move) => ({
  points: [axialToPixel(move.from, HEX_SIZE), axialToPixel(move.to, HEX_SIZE)],
  lift: 1,
  pacing: 'arc',
  durationMs: RELOCATE_MS,
});

/**
 * The route the piece really takes, one cell at a time, staying on the hive.
 * Watch an ant hug the outside and the freedom-of-movement rule explains
 * itself. A piece the engine gives no route flies instead: the grasshopper
 * jumps, a beetle climbs, and a pillbug moves a piece that is not itself.
 */
export const crawlPlanner: FlightPlanner = (move, board) => {
  const route = move.kind === 'throw' ? null : slidePath(move.from, move.to, board);
  if (route === null || route.length < 2) return liftPlanner(move, board);
  const steps = route.length - 1;
  return {
    points: route.map((c) => axialToPixel(c, HEX_SIZE)),
    lift: 0,
    pacing: 'step',
    // Floored at a lift's own duration: a single step at 90ms reads as a jump cut.
    durationMs: Math.min(Math.max(steps * CRAWL_STEP_MS, RELOCATE_MS), CRAWL_MAX_MS),
  };
};

const distance = (a: Pixel, b: Pixel): number => Math.hypot(b.x - a.x, b.y - a.y);

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const smoothstep = (x: number): number => x * x * (3 - 2 * x);

export type FlightPath = {
  readonly positionAt: (t: number) => Pixel;
  readonly scaleAt: (t: number) => number;
};

/**
 * Walks the polyline by cumulative arc length, so a two-point flight and an
 * eight-point one run identical code at an even speed.
 */
export const createFlightPath = (flight: Flight): FlightPath => {
  const points = flight.points;
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const run = lengths[i - 1];
    if (!prev || !cur || run === undefined) continue;
    lengths.push(run + distance(prev, cur));
  }
  const total = lengths[lengths.length - 1] ?? 0;
  const first = points[0] ?? { x: 0, y: 0 };
  const last = points[points.length - 1] ?? first;

  const segments = points.length - 1;

  const stepwise = (t: number): Pixel => {
    const scaled = Math.min(Math.max(t, 0), 1) * segments;
    const i = Math.min(Math.floor(scaled), segments - 1);
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) return last;
    const k = smoothstep(scaled - i);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  const along = (t: number): Pixel => {
    if (total === 0) return first;
    if (flight.pacing === 'step' && segments > 0) return stepwise(t);
    const target = easeInOutCubic(t) * total;
    for (let i = 1; i < points.length; i++) {
      const start = lengths[i - 1];
      const end = lengths[i];
      const a = points[i - 1];
      const b = points[i];
      if (start === undefined || end === undefined || !a || !b) continue;
      if (target > end && i < points.length - 1) continue;
      const span = end - start;
      const k = span === 0 ? 0 : (target - start) / span;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    return last;
  };

  return {
    positionAt: along,
    // Full size at both ends: the tile leaves the board as it starts and has
    // settled by the time it lands.
    scaleAt: (t) => {
      const ramp =
        t < LIFT_RAMP
          ? smoothstep(t / LIFT_RAMP)
          : t > 1 - LIFT_RAMP
            ? smoothstep((1 - t) / LIFT_RAMP)
            : 1;
      return 1 + LIFT_SCALE * flight.lift * ramp;
    },
  };
};

// A placed piece has no `from` to travel out of, so it arrives by growing into
// its cell instead.
export const PLACE_FROM = 0.7;

export const placeScaleAt = (t: number): number => PLACE_FROM + (1 - PLACE_FROM) * smoothstep(t);
