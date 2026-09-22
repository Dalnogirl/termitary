import { describe, expect, it } from 'vitest';
import { type Board, empty, place } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { Piece, PieceType } from '../piece.js';
import { movements } from './index.js';
import { slidePath } from './slide-path.js';

const white = (type: PieceType): Piece => ({ type, color: 'white' });
const black = (type: PieceType): Piece => ({ type, color: 'black' });

const board = (...entries: readonly (readonly [HexCoord, Piece])[]): Board =>
  entries.reduce((acc, [c, p]) => place(acc, c, p), empty());

const route = (path: readonly HexCoord[] | null): string[] | null =>
  path === null ? null : path.map(key);

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const EE: HexCoord = { q: 2, r: 0 };
const NE: HexCoord = { q: 1, r: -1 };
const SE: HexCoord = { q: 0, r: 1 };

describe('slidePath', () => {
  it('is null on an empty cell', () => {
    expect(slidePath(ORIGIN, E, empty())).toBeNull();
  });

  it('is null when the destination is not a legal move', () => {
    const b = board([ORIGIN, white('ant')], [E, black('queen')]);
    expect(slidePath(ORIGIN, { q: 5, r: 5 }, b)).toBeNull();
  });

  describe('ant', () => {
    it('walks one cell at a time, origin first and destination last', () => {
      const b = board([ORIGIN, white('ant')], [E, black('queen')], [EE, white('spider')]);
      const path = slidePath(ORIGIN, { q: 3, r: 0 }, b);
      expect(route(path)).toEqual(['0,0', '1,-1', '2,-1', '3,-1', '3,0']);
    });

    it('takes the shortest of the two ways round', () => {
      const b = board([ORIGIN, white('ant')], [E, black('queen')]);
      expect(route(slidePath(ORIGIN, NE, b))).toEqual(['0,0', '1,-1']);
      expect(route(slidePath(ORIGIN, SE, b))).toEqual(['0,0', '0,1']);
    });

    it('returns a route of adjacent cells for every destination it lists', () => {
      const b = board(
        [ORIGIN, white('ant')],
        [E, black('queen')],
        [EE, white('spider')],
        [NE, black('beetle')],
      );
      for (const to of movements.ant(ORIGIN, b)) {
        const path = slidePath(ORIGIN, to, b);
        expect(path, key(to)).not.toBeNull();
        const cells = path ?? [];
        expect(key(cells[0] ?? ORIGIN)).toBe(key(ORIGIN));
        expect(key(cells[cells.length - 1] ?? ORIGIN)).toBe(key(to));
        for (let i = 1; i < cells.length; i++) {
          const a = cells[i - 1];
          const c = cells[i];
          if (!a || !c) throw new Error('unreachable');
          expect(Math.max(Math.abs(a.q - c.q), Math.abs(a.r - c.r))).toBe(1);
        }
      }
    });
  });

  describe('spider', () => {
    it('walks its own three steps rather than the shortest way', () => {
      const b = board([ORIGIN, white('spider')], [E, black('queen')], [EE, white('ant')]);
      const to = { q: 3, r: -1 };
      expect(movements.spider(ORIGIN, b).map(key)).toContain(key(to));
      expect(route(slidePath(ORIGIN, to, b))).toEqual(['0,0', '1,-1', '2,-1', '3,-1']);
    });

    it('is four cells long for every destination it lists', () => {
      const b = board([ORIGIN, white('spider')], [E, black('queen')], [EE, white('ant')]);
      for (const to of movements.spider(ORIGIN, b)) {
        expect(slidePath(ORIGIN, to, b)?.length, key(to)).toBe(4);
      }
    });
  });

  describe('one-steppers', () => {
    it('gives the queen the two cells', () => {
      const b = board([ORIGIN, white('queen')], [E, black('ant')]);
      expect(route(slidePath(ORIGIN, NE, b))).toEqual(['0,0', '1,-1']);
    });

    it('gives a beetle on the ground the two cells', () => {
      const b = board([ORIGIN, white('beetle')], [E, black('ant')]);
      expect(route(slidePath(ORIGIN, NE, b))).toEqual(['0,0', '1,-1']);
    });

    it('is null for a beetle climbing onto a neighbour', () => {
      const b = board([ORIGIN, white('beetle')], [E, black('ant')]);
      expect(slidePath(ORIGIN, E, b)).toBeNull();
    });

    it('is null for a beetle coming down off a stack', () => {
      const b = board([ORIGIN, black('ant')], [ORIGIN, white('beetle')], [E, black('queen')]);
      expect(slidePath(ORIGIN, NE, b)).toBeNull();
    });
  });

  describe('pieces that do not slide', () => {
    it('is null for the grasshopper', () => {
      const b = board([ORIGIN, white('grasshopper')], [E, black('queen')]);
      expect(slidePath(ORIGIN, EE, b)).toBeNull();
    });

    it('is null for the ladybug', () => {
      const b = board([ORIGIN, white('ladybug')], [E, black('queen')], [EE, black('ant')]);
      const to = movements.ladybug(ORIGIN, b)[0];
      if (!to) throw new Error('expected a ladybug move');
      expect(slidePath(ORIGIN, to, b)).toBeNull();
    });

    it("gives the pillbug its own step, which is a queen's", () => {
      const b = board([ORIGIN, white('pillbug')], [E, black('queen')]);
      expect(route(slidePath(ORIGIN, NE, b))).toEqual(['0,0', '1,-1']);
    });

    it('agrees with a queen on the same board, for a mosquito copying both', () => {
      const b = board([ORIGIN, white('mosquito')], [E, black('queen')], [NE, black('pillbug')]);
      expect(route(slidePath(ORIGIN, SE, b))).toEqual(['0,0', '0,1']);
    });
  });

  describe('mosquito', () => {
    it('takes the route of the one slider it copies', () => {
      const b = board([ORIGIN, white('mosquito')], [E, black('spider')], [EE, white('ant')]);
      const to = { q: 3, r: -1 };
      expect(route(slidePath(ORIGIN, to, b))).toEqual(['0,0', '1,-1', '2,-1', '3,-1']);
    });

    it('takes the route when two copied sliders agree on it', () => {
      const b = board([ORIGIN, white('mosquito')], [E, black('queen')], [NE, black('ant')]);
      expect(route(slidePath(ORIGIN, SE, b))).toEqual(['0,0', '0,1']);
    });

    it('is null when a copied grasshopper reaches the cell too', () => {
      const b = board(
        [ORIGIN, white('mosquito')],
        [E, black('grasshopper')],
        [NE, black('ant')],
        [EE, white('spider')],
      );
      const to = { q: 3, r: 0 };
      expect(movements.grasshopper(ORIGIN, b).map(key)).toContain(key(to));
      expect(slidePath(ORIGIN, to, b)).toBeNull();
    });

    it('is null on a stack, where it is a beetle', () => {
      const b = board([ORIGIN, black('ant')], [ORIGIN, white('mosquito')], [E, black('queen')]);
      expect(slidePath(ORIGIN, NE, b)).toBeNull();
    });
  });
});
