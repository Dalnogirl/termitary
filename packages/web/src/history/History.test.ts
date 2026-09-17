import type { Move } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { formatMove } from './History.js';

const ORIGIN = { q: 0, r: 0 };
const E = { q: 1, r: 0 };
const S = { q: 0, r: 1 };

describe('formatMove', () => {
  it('names the piece a placement put down', () => {
    const move: Move = { kind: 'place', piece: { type: 'queen', color: 'white' }, to: ORIGIN };
    expect(formatMove(move)).toBe('placed Queen at (0,0)');
  });

  it('reads a relocation as the cells it went between', () => {
    expect(formatMove({ kind: 'relocate', from: E, to: S })).toBe('moved (1,0) → (0,1)');
  });

  // Three cells, because the thrower is not the piece that travelled.
  it('leads a throw with the cell that threw', () => {
    const move: Move = { kind: 'throw', by: ORIGIN, from: E, to: S };
    expect(formatMove(move)).toBe('(0,0) threw (1,0) → (0,1)');
  });

  it('reads a pass', () => {
    expect(formatMove({ kind: 'pass' })).toBe('passed');
  });
});
