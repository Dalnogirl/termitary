import { describe, expect, it } from 'vitest';
import type { Move } from './coordinator.js';
import type { HexCoord } from './hex.js';
import { stunnedCell } from './stun.js';

const A: HexCoord = { q: 0, r: 0 };
const B: HexCoord = { q: 1, r: 0 };
const C: HexCoord = { q: 2, r: 0 };

const stunnedAfter = (...history: readonly Move[]) => stunnedCell(history);

describe('stunnedCell', () => {
  it('stuns nothing before the first move', () => {
    expect(stunnedAfter()).toBeUndefined();
  });

  it('stuns where a relocated piece landed', () => {
    expect(stunnedAfter({ kind: 'relocate', from: A, to: B })).toEqual(B);
  });

  it('stuns where a thrown piece landed, not the pillbug that threw it', () => {
    expect(stunnedAfter({ kind: 'throw', by: C, from: A, to: B })).toEqual(B);
  });

  it('stuns nothing after a placement, which is not a piece moving', () => {
    expect(
      stunnedAfter({ kind: 'place', piece: { type: 'ant', color: 'white' }, to: B }),
    ).toBeUndefined();
  });

  it('stuns nothing after a pass', () => {
    expect(stunnedAfter({ kind: 'pass' })).toBeUndefined();
  });

  it('remembers only the last move, so the stun lasts a single turn', () => {
    expect(
      stunnedAfter({ kind: 'relocate', from: A, to: B }, { kind: 'relocate', from: C, to: A }),
    ).toEqual(A);
  });
});
