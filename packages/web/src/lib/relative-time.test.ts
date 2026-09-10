import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time.js';

const NOW = 1_000 * 60 * 60 * 24 * 400;

describe('relativeTime', () => {
  it('calls anything under a minute just now', () => {
    expect(relativeTime(NOW - 59_000, NOW)).toBe('just now');
  });

  it('rounds down to whole minutes', () => {
    expect(relativeTime(NOW - 119_000, NOW)).toBe('1 minute ago');
  });

  it('switches to hours past the hour', () => {
    expect(relativeTime(NOW - 3 * 60 * 60_000, NOW)).toBe('3 hours ago');
  });

  it('switches to days past the day', () => {
    expect(relativeTime(NOW - 50 * 60 * 60_000, NOW)).toBe('2 days ago');
  });

  it('treats a future timestamp as just now rather than counting up', () => {
    expect(relativeTime(NOW + 5_000, NOW)).toBe('just now');
  });
});
