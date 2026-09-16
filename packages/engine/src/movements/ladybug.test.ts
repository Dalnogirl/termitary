import { describe, expect, it } from 'vitest';
import { empty, place } from '../board.js';
import { type HexCoord, key, neighbors } from '../hex.js';
import type { Piece } from '../piece.js';
import { ladybugMovement } from './ladybug.js';

const WA: Piece = { type: 'ant', color: 'white' };
const WB: Piece = { type: 'beetle', color: 'white' };
const WL: Piece = { type: 'ladybug', color: 'white' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const EE: HexCoord = { q: 2, r: 0 };
const EEE: HexCoord = { q: 3, r: 0 };

const board = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  entries.reduce((acc, [c, p]) => place(acc, c, p), empty());

const movesFrom = (...entries: readonly (readonly [HexCoord, Piece])[]) =>
  new Set(ladybugMovement(ORIGIN, board([ORIGIN, WL], ...entries)).map(key));

describe('ladybugMovement', () => {
  it('returns [] when alone on the board', () => {
    expect(ladybugMovement(ORIGIN, board([ORIGIN, WL]))).toEqual([]);
  });

  it('returns [] with a single neighbour, since there is no second cell to cross', () => {
    expect(movesFrom([E, WA])).toEqual(new Set());
  });

  it('lands on every empty cell touching the second roof cell', () => {
    const moves = movesFrom([E, WA], [EE, WA]);
    expect(moves).toEqual(new Set(['3,0', '3,-1', '2,-1', '1,1', '2,1']));
  });

  it('never stops after two steps', () => {
    // (1,-1) touches E, the first roof cell, and nothing further along.
    expect(movesFrom([E, WA], [EE, WA]).has('1,-1')).toBe(false);
  });

  it('never takes a fourth step', () => {
    // (4,0) touches only EEE, which would be a third roof cell.
    expect(movesFrom([E, WA], [EE, WA], [EEE, WA]).has('4,0')).toBe(false);
  });

  it('never returns the cell it started from', () => {
    const ring = neighbors(ORIGIN).map((c) => [c, WA] as const);
    expect(movesFrom(...ring).has(key(ORIGIN))).toBe(false);
  });

  it('crosses a stack and lands beyond it', () => {
    const moves = movesFrom([E, WA], [E, WB], [EE, WA]);
    expect(moves.has('3,0')).toBe(true);
  });

  it('cannot finish on top of the hive', () => {
    const moves = movesFrom([E, WA], [EE, WA], [EEE, WA]);
    expect(moves.has(key(EEE))).toBe(false);
    expect(moves.has(key(E))).toBe(false);
  });

  it('still moves when fully surrounded on the ground, since the first step is upward', () => {
    const ring = neighbors(ORIGIN).map((c) => [c, WA] as const);
    expect(movesFrom(...ring).size).toBeGreaterThan(0);
  });
});
