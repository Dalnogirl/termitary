import { describe, expect, it } from 'vitest';
import { timeControlLabel } from './time-control-label.js';

describe('timeControlLabel', () => {
  it('names a correspondence clock by its days per move', () => {
    expect(timeControlLabel({ kind: 'correspondence', daysPerMove: 1 })).toBe('1 day per move');
    expect(timeControlLabel({ kind: 'correspondence', daysPerMove: 3 })).toBe('3 days per move');
  });

  it('writes a real-time clock as minutes plus increment seconds', () => {
    expect(timeControlLabel({ kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 })).toBe(
      '5+3',
    );
  });

  it('names an untimed game', () => {
    expect(timeControlLabel({ kind: 'untimed' })).toBe('Untimed');
  });
});
