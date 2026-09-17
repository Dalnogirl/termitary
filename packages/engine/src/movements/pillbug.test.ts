import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece } from '../piece.js';
import { pillbugMovement, pillbugThrows } from './pillbug.js';
import { queenMovement } from './queen.js';

const WP: Piece = { type: 'pillbug', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };
const WB: Piece = { type: 'beetle', color: 'white' };
const BA: Piece = { type: 'ant', color: 'black' };
const BB: Piece = { type: 'beetle', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const N: HexCoord = { q: 0, r: -1 };
const W: HexCoord = { q: -1, r: 0 };
const SW: HexCoord = { q: -1, r: 1 };
const S: HexCoord = { q: 0, r: 1 };
const EE: HexCoord = { q: 2, r: 0 };

const board = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  entries.reduce((acc, [c, p]) => place(acc, c, p), empty());

const withPillbug = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  board([ORIGIN, WP], ...entries);

const throwsFrom = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  new Set(pillbugThrows(ORIGIN, withPillbug(...entries)).map((t) => `${key(t.from)}>${key(t.to)}`));

const thrown = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  new Set(pillbugThrows(ORIGIN, withPillbug(...entries)).map((t) => key(t.from)));

const landings = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  new Set(pillbugThrows(ORIGIN, withPillbug(...entries)).map((t) => key(t.to)));

describe('pillbugMovement', () => {
  it('is the queen step', () => {
    const b = withPillbug([E, WA], [EE, WA]);
    expect(pillbugMovement(ORIGIN, b)).toEqual(queenMovement(ORIGIN, b));
  });
});

describe('pillbugThrows', () => {
  it('returns [] when alone on the board', () => {
    expect(pillbugThrows(ORIGIN, withPillbug())).toEqual([]);
  });

  it('lifts a lone neighbour into every other cell around itself', () => {
    expect(throwsFrom([E, WA])).toEqual(
      new Set(['1,0>1,-1', '1,0>0,-1', '1,0>-1,0', '1,0>-1,1', '1,0>0,1']),
    );
  });

  it('throws either colour', () => {
    expect(thrown([E, BA])).toEqual(new Set([key(E)]));
  });

  it('never lands a piece on an occupied cell', () => {
    expect(landings([E, WA], [S, BA])).toEqual(new Set([key(NE), key(N), key(W), key(SW)]));
  });

  it('will not throw a piece whose removal splits the hive', () => {
    expect(thrown([E, WA], [EE, WA])).toEqual(new Set());
  });

  it('throws a piece whose removal leaves the hive whole', () => {
    // Both neighbours hang off the pillbug, so either can go.
    expect(thrown([E, WA], [W, BA])).toEqual(new Set([key(E), key(W)]));
  });

  it('will not throw a stacked piece', () => {
    expect(thrown([E, WA], [E, BB], [W, BA])).toEqual(new Set([key(W)]));
  });

  it('offers nothing while something sits on top of the pillbug', () => {
    expect(pillbugThrows(ORIGIN, withPillbug([ORIGIN, BB], [E, WA]))).toEqual([]);
  });

  it('will not lift a piece up through a gate of two stacks', () => {
    // The shared neighbours of the pillbug and E are NE and S.
    expect(thrown([E, WA], [NE, WA], [NE, WB], [S, BA], [S, BB])).toEqual(new Set([]));
  });

  it('will not set a piece down through a gate of two stacks', () => {
    // The shared neighbours of the pillbug and N are NE and W.
    expect(landings([E, WA], [NE, WA], [NE, WB], [W, BA], [W, BB])).toEqual(
      new Set([key(SW), key(S)]),
    );
  });

  it('lifts over a single piece, which is only as tall as the pillbug', () => {
    expect(thrown([E, WA], [NE, WA], [S, BA])).toContain(key(E));
  });

  it('lands beside a single piece, which is only as tall as the pillbug', () => {
    expect(landings([E, WA], [NE, WA], [W, BA])).toEqual(new Set([key(N), key(SW), key(S)]));
  });

  it('counts a beetle riding the pillbug as covering it, not as a neighbour', () => {
    expect(pillbugThrows(ORIGIN, withPillbug([ORIGIN, WB], [E, WA], [SW, BA]))).toEqual([]);
  });
});
