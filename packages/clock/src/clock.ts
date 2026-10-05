import type {
  CorrespondenceControl,
  RealtimeControl,
  TimeControl,
  UntimedControl,
} from './time-control.js';

export type Side = 'white' | 'black';

// Until both sides have moved once, no bank runs; the side to move has a
// first-move window instead, and missing it abandons the game rather than flags it.
export type ClockPhase = 'pre_start' | 'running';

export type ClockEntry = { readonly side: Side; readonly remainingMs: number };

type ClockCommon = {
  readonly phase: ClockPhase;
  readonly toMove: Side;
  readonly turnStartedAt: number;
  readonly log: readonly ClockEntry[];
};

export type Clock =
  | (UntimedControl & ClockCommon)
  | (CorrespondenceControl & ClockCommon)
  | (RealtimeControl & ClockCommon & { readonly bankMs: Readonly<Record<Side, number>> });

export class IllegalChargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalChargeError';
  }
}

const DAY_MS = 24 * 60 * 60_000;
const REALTIME_FIRST_MOVE_WINDOW_MS = 30_000;

const opponent = (side: Side): Side => (side === 'white' ? 'black' : 'white');

const elapsed = (clock: Clock, now: number): number => Math.max(0, now - clock.turnStartedAt);

const firstMoveWindowMs = (control: TimeControl): number | undefined => {
  switch (control.kind) {
    case 'untimed':
      return undefined;
    case 'correspondence':
      return control.daysPerMove * DAY_MS;
    case 'realtime':
      return REALTIME_FIRST_MOVE_WINDOW_MS;
  }
};

export const startClock = (control: TimeControl, now: number): Clock => {
  const common: ClockCommon = { phase: 'pre_start', toMove: 'white', turnStartedAt: now, log: [] };
  if (control.kind === 'realtime') {
    const bankMs = { white: control.initialMs, black: control.initialMs };
    return { ...control, ...common, bankMs };
  }
  return { ...control, ...common };
};

export const remaining = (clock: Clock, side: Side, now: number): number => {
  const spent = clock.phase === 'running' && clock.toMove === side ? elapsed(clock, now) : 0;
  switch (clock.kind) {
    case 'untimed':
      return Number.POSITIVE_INFINITY;
    case 'correspondence':
      return Math.max(0, clock.daysPerMove * DAY_MS - spent);
    case 'realtime':
      return Math.max(0, clock.bankMs[side] - spent);
  }
};

export const flagged = (clock: Clock, now: number): Side | undefined =>
  clock.phase === 'running' && remaining(clock, clock.toMove, now) <= 0 ? clock.toMove : undefined;

export const firstMoveRemaining = (clock: Clock, now: number): number => {
  const window = clock.phase === 'pre_start' ? firstMoveWindowMs(clock) : undefined;
  if (window === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, window - elapsed(clock, now));
};

export const abandoned = (clock: Clock, now: number): Side | undefined =>
  firstMoveRemaining(clock, now) <= 0 ? clock.toMove : undefined;

export const charge = (clock: Clock, side: Side, now: number): Clock => {
  if (side !== clock.toMove) {
    throw new IllegalChargeError(`It is ${clock.toMove}'s turn, not ${side}'s`);
  }
  if (flagged(clock, now) ?? abandoned(clock, now)) {
    throw new IllegalChargeError(`${side} is out of time`);
  }
  const left = remaining(clock, side, now);
  const turn: ClockCommon = {
    phase: side === 'black' ? 'running' : clock.phase,
    toMove: opponent(side),
    turnStartedAt: Math.max(now, clock.turnStartedAt),
    log: clock.kind === 'untimed' ? clock.log : [...clock.log, { side, remainingMs: left }],
  };
  if (clock.kind === 'realtime' && clock.phase === 'running') {
    const bankMs = { ...clock.bankMs, [side]: left + clock.incrementMs };
    return { ...clock, ...turn, bankMs };
  }
  return { ...clock, ...turn };
};
