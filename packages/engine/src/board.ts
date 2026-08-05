import { type HexCoord, key, parse } from './hex.js';
import type { Piece } from './piece.js';

export type Board = { readonly cells: ReadonlyMap<string, readonly Piece[]> };

const EMPTY_STACK: readonly Piece[] = Object.freeze([]);

export const empty = (): Board => ({ cells: new Map() });

export const fromCells = (entries: Iterable<[HexCoord, readonly Piece[]]>): Board => {
  const cells = new Map<string, readonly Piece[]>();
  for (const [c, stack] of entries) {
    if (stack.length > 0) cells.set(key(c), stack);
  }
  return { cells };
};

export const topPieceAt = (b: Board, c: HexCoord): Piece | undefined => b.cells.get(key(c))?.at(-1);

export const stackAt = (b: Board, c: HexCoord): readonly Piece[] =>
  b.cells.get(key(c)) ?? EMPTY_STACK;

export const isEmpty = (b: Board, c: HexCoord): boolean => !b.cells.has(key(c));

export function* occupiedCells(b: Board): Iterable<[HexCoord, readonly Piece[]]> {
  for (const [k, stack] of b.cells) yield [parse(k), stack];
}

export const place = (b: Board, c: HexCoord, p: Piece): Board => {
  const k = key(c);
  const existing = b.cells.get(k) ?? EMPTY_STACK;
  const next = new Map(b.cells);
  next.set(k, [...existing, p]);
  return { cells: next };
};

export const remove = (b: Board, c: HexCoord): Board => {
  const k = key(c);
  const existing = b.cells.get(k);
  // biome-ignore lint/style/noNonNullAssertion: remove on empty cell is unsupported; MoveValidator gates upstream.
  const newStack = existing!.slice(0, -1);
  const next = new Map(b.cells);
  if (newStack.length === 0) next.delete(k);
  else next.set(k, newStack);
  return { cells: next };
};
