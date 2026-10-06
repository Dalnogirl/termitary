import { type TimeControl, charge, startClock } from '@termitary/clock';
import { describe, expect, it } from 'vitest';
import { WireClockSchema, readClock } from './clock.js';

const T0 = 1_700_000_000_000;
const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };
const DAILY: TimeControl = { kind: 'correspondence', daysPerMove: 1 };

const started = (control: TimeControl) =>
  charge(charge(startClock(control, T0), 'white', T0 + 1_000), 'black', T0 + 2_000);

describe('WireClockSchema', () => {
  it('round-trips a clock of every kind through JSON', () => {
    for (const control of [{ kind: 'untimed' } as const, DAILY, BLITZ]) {
      const clock = started(control);
      expect(WireClockSchema.parse(JSON.parse(JSON.stringify(clock)))).toEqual(clock);
    }
  });

  it('refuses a clock no sequence of charges produces', () => {
    expect(WireClockSchema.safeParse({ ...started(BLITZ), toMove: 'black' }).success).toBe(false);
  });

  it('refuses a correspondence clock outside the offered deadlines', () => {
    expect(WireClockSchema.safeParse({ ...started(DAILY), daysPerMove: 2 }).success).toBe(false);
  });
});

describe('readClock', () => {
  it('reads both banks at the instant given, ticking only the mover', () => {
    expect(readClock(started(BLITZ), T0 + 12_000)).toEqual({
      timeControl: BLITZ,
      remainingMs: { white: 290_000, black: 300_000 },
      firstMoveMs: null,
    });
  });

  it('reads the first-move window, not the bank, before both sides have moved', () => {
    const opened = charge(startClock(BLITZ, T0), 'white', T0 + 1_000);
    expect(readClock(opened, T0 + 11_000)).toEqual({
      timeControl: BLITZ,
      remainingMs: { white: 300_000, black: 300_000 },
      firstMoveMs: 20_000,
    });
  });

  it('has no times for an untimed game', () => {
    expect(readClock(startClock({ kind: 'untimed' }, T0), T0)).toEqual({
      timeControl: { kind: 'untimed' },
      remainingMs: null,
      firstMoveMs: null,
    });
  });
});
