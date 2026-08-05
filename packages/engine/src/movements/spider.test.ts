import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece } from '../piece.js';
import { spiderMovement } from './spider.js';

const WA: Piece = { type: 'ant', color: 'white' };
const WS: Piece = { type: 'spider', color: 'white' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const EE: HexCoord = { q: 2, r: 0 };

describe('spiderMovement', () => {
  it('returns [] when alone on the board', () => {
    const b = place(empty(), ORIGIN, WS);
    expect(spiderMovement(ORIGIN, b)).toEqual([]);
  });

  it('with one adjacent friend: exactly 3 steps lands on the cell directly opposite', () => {
    // Spider at ORIGIN, friend at E. The spider walks 3 steps around the friend.
    // Either direction (via NE or SE) takes exactly 3 steps to reach (2, 0).
    const b = place(place(empty(), ORIGIN, WS), E, WA);
    const moves = new Set(spiderMovement(ORIGIN, b).map(key));
    expect(moves).toEqual(new Set([key(EE)]));
  });

  it('does not return the starting cell or any cell within 2 steps', () => {
    const b = place(place(empty(), ORIGIN, WS), E, WA);
    const moves = spiderMovement(ORIGIN, b).map(key);
    expect(moves).not.toContain(key(ORIGIN));
    expect(moves).not.toContain(key({ q: 1, r: -1 })); // NE — reached in 1 step
  });

  it('with a longer arc of friends, reaches cells exactly 3 sliding steps away', () => {
    // Spider at ORIGIN; friends at E=(1,0), EE=(2,0), (3,0). Two 3-step paths:
    //   top arc:    (0,0) -> (1,-1) -> (2,-1) -> (3,-1)  [touches (3,0)]
    //   bottom arc: (0,0) -> (0,1)  -> (1,1)  -> (2,1)   [touches EE and (3,0)]
    const b = [
      [E, WA],
      [EE, WA],
      [{ q: 3, r: 0 }, WA],
    ].reduce((acc, [c, p]) => place(acc, c as HexCoord, p as Piece), place(empty(), ORIGIN, WS));
    const moves = new Set(spiderMovement(ORIGIN, b).map(key));
    expect(moves.has('3,-1')).toBe(true);
    expect(moves.has('2,1')).toBe(true);
  });

  it('never returns a cell reachable only via path-revisit', () => {
    // Spider at ORIGIN, friend at E. Cells reachable in <=2 steps include NE
    // and (2,-1). After step 3 from (2,-1) we'd land on EE which IS valid.
    // (1,-1) -> path includes it, so it cannot be both step-1 and step-3.
    const b = place(place(empty(), ORIGIN, WS), E, WA);
    const moves = spiderMovement(ORIGIN, b).map(key);
    // 1-step destinations should not appear.
    expect(moves).not.toContain('1,-1');
    expect(moves).not.toContain('0,1');
  });
});
