import { describe, expect, it } from 'vitest';
import { type Marks, isDimmed } from './marks.js';

const marks = (overrides: Partial<Marks>): Marks => ({
  movable: new Set(),
  throwable: new Set(),
  selected: null,
  lifted: null,
  lastMove: null,
  ...overrides,
});

describe('isDimmed', () => {
  it('dims nothing without a selected cell', () => {
    expect(isDimmed(marks({ movable: new Set(['1,0']) }), '1,0')).toBe(false);
  });

  it('dims every cell but the selected one', () => {
    const m = marks({ selected: '0,0', movable: new Set(['0,0', '1,0']), lastMove: '2,0' });
    expect(isDimmed(m, '0,0')).toBe(false);
    expect(isDimmed(m, '1,0')).toBe(true);
    expect(isDimmed(m, '2,0')).toBe(true);
  });

  it('keeps a pillbug, its lifted piece and its throwable neighbours lit', () => {
    const m = marks({ selected: '0,0', lifted: '1,0', throwable: new Set(['1,0', '0,1']) });
    expect(isDimmed(m, '0,0')).toBe(false);
    expect(isDimmed(m, '1,0')).toBe(false);
    expect(isDimmed(m, '0,1')).toBe(false);
    expect(isDimmed(m, '-1,0')).toBe(true);
  });
});
