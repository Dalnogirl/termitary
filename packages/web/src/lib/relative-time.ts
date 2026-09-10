const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** Coarse and backward-looking: lobby rows only ever show a past timestamp. */
export const relativeTime = (epochMs: number, now: number = Date.now()): string => {
  const elapsed = now - epochMs;
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return format.format(-Math.floor(elapsed / HOUR), 'hour');
  return format.format(-Math.floor(elapsed / DAY), 'day');
};
