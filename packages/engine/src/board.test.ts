import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Board,
  empty,
  fromCells,
  isEmpty,
  occupiedCells,
  place,
  remove,
  stackAt,
  topPieceAt,
} from './board.js';
import { type HexCoord, key } from './hex.js';
import type { Color, Piece, PieceType } from './piece.js';

const WA: Piece = { type: 'ant', color: 'white' };
const BB: Piece = { type: 'beetle', color: 'black' };
const WQ: Piece = { type: 'queen', color: 'white' };
const C0: HexCoord = { q: 0, r: 0 };
const C1: HexCoord = { q: 1, r: 0 };

describe('empty', () => {
  it('has no occupied cells', () => {
    expect([...occupiedCells(empty())]).toEqual([]);
    expect(isEmpty(empty(), C0)).toBe(true);
  });
});

describe('place', () => {
  it('adds piece to empty cell', () => {
    const b = place(empty(), C0, WA);
    expect(topPieceAt(b, C0)).toEqual(WA);
    expect(stackAt(b, C0)).toEqual([WA]);
    expect(isEmpty(b, C0)).toBe(false);
  });

  it('stacks beetle on top', () => {
    const b = place(place(empty(), C0, WA), C0, BB);
    expect(topPieceAt(b, C0)).toEqual(BB);
    expect(stackAt(b, C0)).toEqual([WA, BB]);
  });

  it('handles 3-deep stack', () => {
    const b = [WA, BB, WQ].reduce((acc, p) => place(acc, C0, p), empty());
    expect(stackAt(b, C0)).toEqual([WA, BB, WQ]);
    expect(topPieceAt(b, C0)).toEqual(WQ);
  });

  it('does not mutate input board', () => {
    const b0 = empty();
    const b1 = place(b0, C0, WA);
    expect(b0.cells.size).toBe(0);
    expect(b1.cells.size).toBe(1);
    expect(b0).not.toBe(b1);
  });
});

describe('remove', () => {
  it('pops top of stack', () => {
    const b = place(place(empty(), C0, WA), C0, BB);
    const after = remove(b, C0);
    expect(stackAt(after, C0)).toEqual([WA]);
    expect(topPieceAt(after, C0)).toEqual(WA);
  });

  it('drops key when stack becomes empty', () => {
    const b = place(empty(), C0, WA);
    const after = remove(b, C0);
    expect(isEmpty(after, C0)).toBe(true);
    expect(after.cells.has(key(C0))).toBe(false);
  });

  it('does not mutate input board', () => {
    const b = place(empty(), C0, WA);
    const after = remove(b, C0);
    expect(b.cells.size).toBe(1);
    expect(after.cells.size).toBe(0);
  });
});

describe('topPieceAt / stackAt / isEmpty on empty cells', () => {
  it('return undefined / [] / true', () => {
    const b = empty();
    expect(topPieceAt(b, C0)).toBeUndefined();
    expect(stackAt(b, C0)).toEqual([]);
    expect(isEmpty(b, C0)).toBe(true);
  });
});

describe('fromCells', () => {
  it('builds board from entries', () => {
    const b = fromCells([
      [C0, [WA]],
      [C1, [WA, BB]],
    ]);
    expect(stackAt(b, C0)).toEqual([WA]);
    expect(stackAt(b, C1)).toEqual([WA, BB]);
  });

  it('skips empty stacks to preserve invariant', () => {
    const b = fromCells([[C0, []]]);
    expect(isEmpty(b, C0)).toBe(true);
    expect([...occupiedCells(b)]).toEqual([]);
  });
});

describe('occupiedCells', () => {
  it('iterates only occupied cells with parsed coords', () => {
    const b = place(place(empty(), C0, WA), C1, BB);
    const entries = [...occupiedCells(b)];
    expect(entries).toHaveLength(2);
    const byKey = new Map(entries.map(([c, s]) => [key(c), s]));
    expect(byKey.get('0,0')).toEqual([WA]);
    expect(byKey.get('1,0')).toEqual([BB]);
  });
});

const PIECE_TYPES = [
  'queen',
  'ant',
  'grasshopper',
  'spider',
  'beetle',
] as const satisfies readonly PieceType[];
const COLORS = ['white', 'black'] as const satisfies readonly Color[];

const pieceArb: fc.Arbitrary<Piece> = fc.record({
  type: fc.constantFrom(...PIECE_TYPES),
  color: fc.constantFrom(...COLORS),
});

const coordArb: fc.Arbitrary<HexCoord> = fc.record({
  q: fc.integer({ min: -5, max: 5 }),
  r: fc.integer({ min: -5, max: 5 }),
});

type Op = { kind: 'place'; c: HexCoord; p: Piece } | { kind: 'remove'; c: HexCoord };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('place' as const), c: coordArb, p: pieceArb }),
  fc.record({ kind: fc.constant('remove' as const), c: coordArb }),
);

const applyOps = (b: Board, ops: readonly Op[]): Board => {
  let cur = b;
  for (const op of ops) {
    if (op.kind === 'place') cur = place(cur, op.c, op.p);
    else if (!isEmpty(cur, op.c)) cur = remove(cur, op.c);
  }
  return cur;
};

const sortedEntries = (b: Board): Array<[string, readonly Piece[]]> =>
  [...b.cells].sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0));

describe('property: empty-array invariant', () => {
  it('no cell ever maps to an empty stack', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 30 }), (ops) => {
        const b = applyOps(empty(), ops);
        for (const [, stack] of b.cells) {
          expect(stack.length).toBeGreaterThan(0);
        }
      }),
    );
  });
});

describe('property: place then remove restores empty', () => {
  it('remove(place(empty,c,p),c) equals empty', () => {
    fc.assert(
      fc.property(coordArb, pieceArb, (c, p) => {
        const after = remove(place(empty(), c, p), c);
        expect([...after.cells]).toEqual([]);
      }),
    );
  });
});

describe('property: fromCells then occupiedCells round-trip', () => {
  it('rebuilds an equivalent board', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const b = applyOps(empty(), ops);
        const rebuilt = fromCells(occupiedCells(b));
        expect(sortedEntries(rebuilt)).toEqual(sortedEntries(b));
      }),
    );
  });
});

describe('property: place never mutates input', () => {
  it('input cells snapshot is unchanged after place', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 10 }), coordArb, pieceArb, (ops, c, p) => {
        const b = applyOps(empty(), ops);
        const snapshot = sortedEntries(b).map(([k, s]) => [k, [...s]] as const);
        place(b, c, p);
        const after = sortedEntries(b).map(([k, s]) => [k, [...s]] as const);
        expect(after).toEqual(snapshot);
      }),
    );
  });
});
