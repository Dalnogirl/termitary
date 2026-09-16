import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key, neighbors } from '../hex.js';
import type { Piece } from '../piece.js';
import { antMovement } from './ant.js';
import { beetleMovement } from './beetle.js';
import { grasshopperMovement } from './grasshopper.js';
import { mosquitoMovement } from './mosquito.js';
import { queenMovement } from './queen.js';

const WA: Piece = { type: 'ant', color: 'white' };
const WB: Piece = { type: 'beetle', color: 'white' };
const WQ: Piece = { type: 'queen', color: 'white' };
const WM: Piece = { type: 'mosquito', color: 'white' };
const BG: Piece = { type: 'grasshopper', color: 'black' };
const BM: Piece = { type: 'mosquito', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const EE: HexCoord = { q: 2, r: 0 };

const board = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  entries.reduce((acc, [c, p]) => place(acc, c, p), empty());

const keys = (moves: readonly HexCoord[]) => new Set(moves.map(key));

const withMosquito = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  board([ORIGIN, WM], ...entries);

const movesFrom = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  keys(mosquitoMovement(ORIGIN, withMosquito(...entries)));

describe('mosquitoMovement', () => {
  it('returns [] when alone on the board', () => {
    expect(mosquitoMovement(ORIGIN, withMosquito())).toEqual([]);
  });

  it('returns [] beside nothing but mosquitoes, of either colour', () => {
    expect(movesFrom([E, BM], [NE, WM])).toEqual(new Set());
  });

  it('moves as an ant beside an ant', () => {
    const b = withMosquito([E, WA]);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(keys(antMovement(ORIGIN, b)));
  });

  it('copies from either colour', () => {
    const b = withMosquito([E, BG]);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(keys(grasshopperMovement(ORIGIN, b)));
  });

  it('offers both beside an ant and a grasshopper', () => {
    const b = withMosquito([E, WA], [NE, BG]);
    const union = keys([...antMovement(ORIGIN, b), ...grasshopperMovement(ORIGIN, b)]);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(union);
  });

  it('adds nothing for a mosquito among its neighbours', () => {
    const b = withMosquito([E, WA], [NE, BM]);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(keys(antMovement(ORIGIN, b)));
  });

  it('copies the top of a neighbouring stack, not what is buried under it', () => {
    // An ant with a beetle parked on it is a beetle to copy, and a beetle
    // cannot reach the far side of the hive the way the ant could.
    const b = withMosquito([E, WA], [E, WB], [EE, WA]);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(keys(beetleMovement(ORIGIN, b)));
  });

  it('reads its own stack, so a tall neighbour leaves it on the ground', () => {
    const b = withMosquito([E, WA], [E, WQ]);
    const asQueen = keys(queenMovement(ORIGIN, b));
    expect(asQueen.size).toBeGreaterThan(0);
    expect(keys(mosquitoMovement(ORIGIN, b))).toEqual(asQueen);
  });

  it('climbs onto a neighbouring stack by copying the beetle on top of it', () => {
    expect(movesFrom([E, WA], [E, WB]).has(key(E))).toBe(true);
  });

  it('is a beetle on top of the hive, even standing beside an ant', () => {
    // Every neighbour, which up here is the five empty cells it can step down
    // into and the ant it can cross onto. An ant's reach is not among them.
    const b = board([ORIGIN, WQ], [ORIGIN, WM], [E, WA]);
    const moves = mosquitoMovement(ORIGIN, b);
    expect(keys(moves)).toEqual(keys(beetleMovement(ORIGIN, b)));
    expect(keys(moves)).toEqual(new Set(neighbors(ORIGIN).map(key)));
  });
});
