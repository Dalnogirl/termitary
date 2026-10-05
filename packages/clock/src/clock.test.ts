import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Clock,
  IllegalChargeError,
  type Side,
  abandoned,
  charge,
  clockDefect,
  firstMoveRemaining,
  flagged,
  remaining,
  startClock,
  timeControlOf,
} from './clock.js';
import type { TimeControl } from './time-control.js';

const T0 = 1_700_000_000_000;
const SEC = 1_000;
const DAY = 24 * 60 * 60 * SEC;

const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300 * SEC, incrementMs: 3 * SEC };
const DAILY: TimeControl = { kind: 'correspondence', daysPerMove: 1 };
const UNTIMED: TimeControl = { kind: 'untimed' };

// White moves at T0 + 1s, black at T0 + 2s: both first moves done, white's bank running.
const started = (control: TimeControl): Clock =>
  charge(charge(startClock(control, T0), 'white', T0 + SEC), 'black', T0 + 2 * SEC);

describe('startClock', () => {
  it('opens the pre-start phase with white to move', () => {
    const clock = startClock(BLITZ, T0);
    expect(clock.phase).toBe('pre_start');
    expect(clock.toMove).toBe('white');
    expect(clock.log).toEqual([]);
  });

  it('survives a JSON round trip for every kind', () => {
    for (const control of [UNTIMED, DAILY, BLITZ]) {
      const clock = started(control);
      expect(JSON.parse(JSON.stringify(clock))).toEqual(clock);
    }
  });
});

describe('pre-start phase', () => {
  it('runs no bank while white thinks over the first move', () => {
    const clock = startClock(BLITZ, T0);
    expect(remaining(clock, 'white', T0 + 20 * SEC)).toBe(300 * SEC);
  });

  it('charges neither time nor increment for the first moves', () => {
    const clock = started(BLITZ);
    expect(remaining(clock, 'white', T0 + 2 * SEC)).toBe(300 * SEC);
    expect(remaining(clock, 'black', T0 + 2 * SEC)).toBe(300 * SEC);
  });

  it('starts running after black has moved', () => {
    const afterWhite = charge(startClock(BLITZ, T0), 'white', T0 + SEC);
    expect(afterWhite.phase).toBe('pre_start');
    expect(charge(afterWhite, 'black', T0 + 2 * SEC).phase).toBe('running');
  });

  it('abandons white once the 30s real-time window passes', () => {
    const clock = startClock(BLITZ, T0);
    expect(abandoned(clock, T0 + 29_999)).toBeUndefined();
    expect(abandoned(clock, T0 + 30 * SEC)).toBe('white');
    expect(flagged(clock, T0 + 30 * SEC)).toBeUndefined();
  });

  it("opens black's window at white's first charge", () => {
    const clock = charge(startClock(BLITZ, T0), 'white', T0 + 25 * SEC);
    expect(abandoned(clock, T0 + 54 * SEC)).toBeUndefined();
    expect(abandoned(clock, T0 + 55 * SEC)).toBe('black');
  });

  it('gives correspondence one per-move deadline as the window', () => {
    const clock = startClock({ kind: 'correspondence', daysPerMove: 3 }, T0);
    expect(abandoned(clock, T0 + 3 * DAY - 1)).toBeUndefined();
    expect(abandoned(clock, T0 + 3 * DAY)).toBe('white');
  });

  it('never abandons an untimed game', () => {
    expect(abandoned(startClock(UNTIMED, T0), T0 + 365 * DAY)).toBeUndefined();
  });

  it('stops abandoning once both sides have moved', () => {
    expect(abandoned(started(DAILY), T0 + 30 * DAY)).toBeUndefined();
  });
});

describe('realtime', () => {
  it("runs only the mover's bank", () => {
    const clock = started(BLITZ);
    expect(remaining(clock, 'white', T0 + 12 * SEC)).toBe(290 * SEC);
    expect(remaining(clock, 'black', T0 + 12 * SEC)).toBe(300 * SEC);
  });

  it('adds the increment on charge', () => {
    const clock = charge(started(BLITZ), 'white', T0 + 12 * SEC);
    expect(remaining(clock, 'white', T0 + 100 * SEC)).toBe(293 * SEC);
  });

  it('flags the mover when the bank runs out', () => {
    const clock = started(BLITZ);
    expect(flagged(clock, T0 + 302 * SEC - 1)).toBeUndefined();
    expect(flagged(clock, T0 + 302 * SEC)).toBe('white');
    expect(remaining(clock, 'white', T0 + 400 * SEC)).toBe(0);
  });
});

describe('correspondence', () => {
  it('counts down the per-move deadline for the mover only', () => {
    const clock = started(DAILY);
    expect(remaining(clock, 'white', T0 + 2 * SEC + 6 * 3_600_000)).toBe(18 * 3_600_000);
    expect(remaining(clock, 'black', T0 + 2 * SEC + 6 * 3_600_000)).toBe(DAY);
  });

  it("resets the next side's deadline on charge, with no bank carried over", () => {
    const clock = charge(started(DAILY), 'white', T0 + 2 * SEC + 1_000);
    expect(remaining(clock, 'black', T0 + 2 * SEC + 1_000)).toBe(DAY);
    expect(remaining(clock, 'white', T0 + 2 * SEC + 1_000)).toBe(DAY);
  });

  it('flags the mover at the deadline', () => {
    const clock = started(DAILY);
    expect(flagged(clock, T0 + 2 * SEC + DAY)).toBe('white');
  });
});

describe('untimed', () => {
  it('has unlimited time and never flags', () => {
    const clock = started(UNTIMED);
    expect(remaining(clock, 'white', T0 + 365 * DAY)).toBe(Number.POSITIVE_INFINITY);
    expect(flagged(clock, T0 + 365 * DAY)).toBeUndefined();
  });

  it('keeps no log', () => {
    expect(charge(started(UNTIMED), 'white', T0 + DAY).log).toEqual([]);
  });
});

describe('charge', () => {
  it('logs the time the mover had left, before any increment', () => {
    const clock = charge(started(BLITZ), 'white', T0 + 12 * SEC);
    expect(clock.log).toEqual([
      { side: 'white', remainingMs: 300 * SEC },
      { side: 'black', remainingMs: 300 * SEC },
      { side: 'white', remainingMs: 290 * SEC },
    ]);
  });

  it('refuses the side not on move', () => {
    expect(() => charge(started(BLITZ), 'black', T0 + 3 * SEC)).toThrow(IllegalChargeError);
  });

  it('refuses a side that already flagged', () => {
    expect(() => charge(started(BLITZ), 'white', T0 + 400 * SEC)).toThrow(IllegalChargeError);
  });

  it('refuses a side that missed its first-move window', () => {
    expect(() => charge(startClock(BLITZ, T0), 'white', T0 + 31 * SEC)).toThrow(IllegalChargeError);
  });

  it('does not mutate its input', () => {
    const clock = started(BLITZ);
    const before = structuredClone(clock);
    charge(clock, 'white', T0 + 5 * SEC);
    expect(clock).toEqual(before);
  });
});

describe('firstMoveRemaining', () => {
  it('counts down the window during pre-start', () => {
    expect(firstMoveRemaining(startClock(BLITZ, T0), T0 + 12 * SEC)).toBe(18 * SEC);
  });

  it('is unlimited once running, and for untimed', () => {
    expect(firstMoveRemaining(started(BLITZ), T0 + DAY)).toBe(Number.POSITIVE_INFINITY);
    expect(firstMoveRemaining(startClock(UNTIMED, T0), T0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('a clock running backwards', () => {
  it('does not bill the skew to the next mover', () => {
    const clock = charge(started(BLITZ), 'white', T0 + SEC);
    expect(clock.turnStartedAt).toBe(T0 + 2 * SEC);
    expect(remaining(clock, 'black', T0 + 2 * SEC)).toBe(300 * SEC);
  });
});

describe('timeControlOf', () => {
  it('gives back the control a clock started from, whatever has been charged', () => {
    for (const control of [UNTIMED, DAILY, BLITZ]) {
      expect(timeControlOf(started(control))).toEqual(control);
    }
  });
});

describe('clockDefect', () => {
  it('passes a clock straight from startClock', () => {
    for (const control of [UNTIMED, DAILY, BLITZ]) {
      expect(clockDefect(startClock(control, T0))).toBeUndefined();
    }
  });

  it('catches an empty bank', () => {
    const clock = started(BLITZ);
    if (clock.kind !== 'realtime') throw new Error('unreachable');
    expect(clockDefect({ ...clock, bankMs: { ...clock.bankMs, black: 0 } })).toBeDefined();
  });

  it('catches a phase the log disagrees with', () => {
    expect(clockDefect({ ...startClock(BLITZ, T0), phase: 'running' })).toBeDefined();
    expect(clockDefect({ ...started(DAILY), phase: 'pre_start' })).toBeDefined();
  });

  it('catches a side to move the log disagrees with', () => {
    expect(clockDefect({ ...started(BLITZ), toMove: 'black' })).toBeDefined();
  });

  it('catches a log out of turn', () => {
    const clock = started(DAILY);
    const [first, second] = clock.log;
    if (first === undefined || second === undefined) throw new Error('expected two entries');
    expect(clockDefect({ ...clock, log: [second, first] })).toBeDefined();
  });

  it('catches a turn that started before the epoch', () => {
    expect(clockDefect({ ...started(BLITZ), turnStartedAt: -1 })).toBeDefined();
  });

  it('catches an untimed clock with a log', () => {
    expect(
      clockDefect({ ...startClock(UNTIMED, T0), log: [{ side: 'white', remainingMs: 1 }] }),
    ).toBeDefined();
  });
});

const SIDES: readonly Side[] = ['white', 'black'];

type Step = { readonly dt: number; readonly move: boolean };

// Each kind gets steps on its own scale, or real-time games would all be abandoned on step one.
const maxStepMs = (control: TimeControl): number => {
  switch (control.kind) {
    case 'untimed':
      return 2 * DAY;
    case 'correspondence':
      return Math.round(1.5 * control.daysPerMove * DAY);
    case 'realtime':
      return 15 * SEC;
  }
};

const controlArb: fc.Arbitrary<TimeControl> = fc.oneof(
  fc.constant<TimeControl>(UNTIMED),
  fc.constantFrom<TimeControl>(
    { kind: 'correspondence', daysPerMove: 1 },
    { kind: 'correspondence', daysPerMove: 3 },
  ),
  fc.record({
    kind: fc.constant('realtime' as const),
    initialMs: fc.integer({ min: 1, max: 180 * SEC }),
    incrementMs: fc.integer({ min: 0, max: 10 * SEC }),
  }),
);

const gameArb = controlArb.chain((control) =>
  fc.tuple(
    fc.constant(control),
    fc.array(
      fc.record({ dt: fc.integer({ min: 0, max: maxStepMs(control) }), move: fc.boolean() }),
      {
        maxLength: 60,
      },
    ),
  ),
);

const outOfTime = (clock: Clock, now: number): boolean =>
  flagged(clock, now) !== undefined || abandoned(clock, now) !== undefined;

// Plays the steps, charging the mover on a `move` step unless they are out of time.
const play = (
  control: TimeControl,
  steps: readonly Step[],
  observe: (clock: Clock, now: number, charged: Side | undefined) => void,
): Clock => {
  let now = T0;
  let clock = startClock(control, now);
  for (const step of steps) {
    now += step.dt;
    const mover = clock.toMove;
    const charged = step.move && !outOfTime(clock, now) ? mover : undefined;
    if (charged) clock = charge(clock, mover, now);
    observe(clock, now, charged);
  }
  return clock;
};

const raisedBy = (control: TimeControl): number => {
  switch (control.kind) {
    case 'untimed':
      return 0;
    case 'correspondence':
      return control.daysPerMove * DAY;
    case 'realtime':
      return control.incrementMs;
  }
};

describe('properties', () => {
  it('gets a fair share of real-time games past the first-move windows', () => {
    const phases = fc
      .sample(gameArb, { numRuns: 300, seed: 180 })
      .filter(([control]) => control.kind === 'realtime')
      .map(([control, steps]) => play(control, steps, () => {}).phase);
    const running = phases.filter((phase) => phase === 'running');
    expect(running.length).toBeGreaterThan(phases.length / 4);
  });

  it('remaining never goes up except by the increment on its own charge', () => {
    fc.assert(
      fc.property(gameArb, ([control, steps]) => {
        let before: Record<Side, number> = { white: Number.NaN, black: Number.NaN };
        play(control, steps, (clock, now, charged) => {
          for (const side of SIDES) {
            const after = remaining(clock, side, now);
            const allowance = charged === side ? raisedBy(control) : 0;
            if (!Number.isNaN(before[side])) {
              expect(after).toBeLessThanOrEqual(before[side] + allowance);
            }
            before = { ...before, [side]: after };
          }
        });
      }),
    );
  });

  it('finds no defect in any clock charge produces', () => {
    fc.assert(
      fc.property(gameArb, ([control, steps]) => {
        play(control, steps, (clock) => expect(clockDefect(clock)).toBeUndefined());
      }),
    );
  });

  it('flagged agrees with remaining <= 0', () => {
    fc.assert(
      fc.property(gameArb, ([control, steps]) => {
        play(control, steps, (clock, now) => {
          for (const side of SIDES) {
            expect(flagged(clock, now) === side).toBe(remaining(clock, side, now) <= 0);
          }
        });
      }),
    );
  });

  it('a real-time bank is the initial time plus increments earned minus time spent', () => {
    const realtimeGameArb = gameArb.filter(([control]) => control.kind === 'realtime');
    fc.assert(
      fc.property(realtimeGameArb, ([control, steps]) => {
        if (control.kind !== 'realtime') return;
        const spent: Record<Side, number> = { white: 0, black: 0 };
        const earned: Record<Side, number> = { white: 0, black: 0 };
        let runningSince: number | undefined;
        play(control, steps, (clock, now, charged) => {
          if (charged && runningSince !== undefined) {
            spent[charged] += now - runningSince;
            earned[charged] += control.incrementMs;
          }
          if (charged && clock.phase === 'running') runningSince = now;
          for (const side of SIDES) {
            const ticking = runningSince !== undefined && clock.toMove === side;
            const used = spent[side] + (ticking ? now - (runningSince ?? now) : 0);
            const expected = Math.max(0, control.initialMs + earned[side] - used);
            expect(remaining(clock, side, now)).toBe(expected);
          }
        });
      }),
    );
  });
});
