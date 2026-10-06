import type { Color } from '@termitary/engine';
import type { WireClockReading } from '@termitary/protocol';

/**
 * The last reading the server sent, and when it landed. Every display is
 * counted down from here, so the next reading replaces any drift.
 */
export type ClockSnapshot = {
  readonly reading: WireClockReading;
  /** Null once the game is over, when neither side ticks. */
  readonly toMove: Color | null;
  /** `performance.now()` on arrival. */
  readonly receivedAt: number;
};

/** What `side`'s clock reads at `now`, or null when the game is untimed. */
export const remainingAt = (snapshot: ClockSnapshot, side: Color, now: number): number | null => {
  const { remainingMs, firstMoveMs } = snapshot.reading;
  if (remainingMs === null) return null;
  if (side !== snapshot.toMove) return remainingMs[side];
  const from = firstMoveMs ?? remainingMs[side];
  return Math.max(0, from - Math.max(0, now - snapshot.receivedAt));
};

/** Whether `side` is counting down its first-move window rather than its bank. */
export const onFirstMove = (snapshot: ClockSnapshot, side: Color): boolean =>
  side === snapshot.toMove && snapshot.reading.firstMoveMs !== null;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TEN_SECONDS_IN_TENTHS = 100;

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `m:ss`, `h:mm:ss` past an hour, and `s.t` under ten seconds. Rounded up, so
 * the display reads zero only once the time is actually gone.
 */
export const formatRealtime = (ms: number): string => {
  const tenths = Math.ceil(ms / 100);
  if (tenths < TEN_SECONDS_IN_TENTHS) return (tenths / 10).toFixed(1);
  const total = Math.ceil(ms / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** The two largest units left, `2d 4h left`, down to `<1m left`. */
export const formatDeadline = (ms: number): string => {
  if (ms < MINUTE) return ms > 0 ? '<1m left' : 'out of time';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};
