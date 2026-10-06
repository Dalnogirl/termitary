import { describe, expect, it } from 'vitest';
import {
  type ClockSnapshot,
  formatDeadline,
  formatRealtime,
  onFirstMove,
  remainingAt,
} from './clock-face.js';

const BLITZ = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 } as const;

const snapshot = (overrides: Partial<ClockSnapshot['reading']> = {}): ClockSnapshot => ({
  reading: {
    timeControl: BLITZ,
    remainingMs: { white: 200_000, black: 100_000 },
    firstMoveMs: null,
    ...overrides,
  },
  toMove: 'white',
  receivedAt: 1_000,
});

describe('remainingAt', () => {
  it('counts down the side to move from the moment the reading landed', () => {
    expect(remainingAt(snapshot(), 'white', 13_000)).toBe(188_000);
  });

  it('holds the waiting side where the server left it', () => {
    expect(remainingAt(snapshot(), 'black', 13_000)).toBe(100_000);
  });

  it('stops at zero', () => {
    expect(remainingAt(snapshot(), 'white', 900_000)).toBe(0);
  });

  it('counts down the first-move window instead of the bank before both sides have moved', () => {
    const opening = snapshot({ firstMoveMs: 30_000 });
    expect(remainingAt(opening, 'white', 11_000)).toBe(20_000);
    expect(remainingAt(opening, 'black', 11_000)).toBe(100_000);
    expect(onFirstMove(opening, 'white')).toBe(true);
    expect(onFirstMove(opening, 'black')).toBe(false);
  });

  it('ticks neither side once the game is over', () => {
    expect(remainingAt({ ...snapshot(), toMove: null }, 'white', 13_000)).toBe(200_000);
  });

  it('reads nothing for an untimed game', () => {
    const untimed = snapshot({ timeControl: { kind: 'untimed' }, remainingMs: null });
    expect(remainingAt(untimed, 'white', 13_000)).toBeNull();
  });
});

describe('formatRealtime', () => {
  it.each([
    [300_000, '5:00'],
    [61_001, '1:02'],
    [10_000, '0:10'],
    [9_999, '0:10'],
    [9_901, '0:10'],
    [9_900, '9.9'],
    [1, '0.1'],
    [0, '0.0'],
    [3_600_000, '1:00:00'],
  ])('%i ms reads %s', (ms, text) => {
    expect(formatRealtime(ms)).toBe(text);
  });
});

describe('formatDeadline', () => {
  it.each([
    [3 * 86_400_000, '3d 0h left'],
    [86_400_000 + 4 * 3_600_000 + 59 * 60_000, '1d 4h left'],
    [5 * 3_600_000 + 12 * 60_000, '5h 12m left'],
    [12 * 60_000 + 59_000, '12m left'],
    [59_000, '<1m left'],
    [0, 'out of time'],
  ])('%i ms reads %s', (ms, text) => {
    expect(formatDeadline(ms)).toBe(text);
  });
});
