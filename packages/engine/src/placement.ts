import { type Board, isEmpty, occupiedCells, topPieceAt } from './board.js';
import { type HexCoord, key, neighbors } from './hex.js';
import type { Color } from './piece.js';

const ORIGIN: HexCoord = { q: 0, r: 0 };

const emptyCellsAdjacentToHive = (board: Board): HexCoord[] => {
  const seen = new Set<string>();
  const result: HexCoord[] = [];
  for (const [c] of occupiedCells(board)) {
    for (const n of neighbors(c)) {
      const nk = key(n);
      if (seen.has(nk)) continue;
      if (!isEmpty(board, n)) continue;
      seen.add(nk);
      result.push(n);
    }
  }
  return result;
};

export const getValidPlacementCoords = (
  board: Board,
  color: Color,
  turnNumber: number,
): HexCoord[] => {
  // White's first piece is forced to the origin (canonical board orientation).
  if (turnNumber === 0 && color === 'white') {
    return isEmpty(board, ORIGIN) ? [ORIGIN] : [];
  }

  // Black's first piece may land anywhere adjacent to the hive (white's opener).
  if (turnNumber === 0 && color === 'black') {
    return emptyCellsAdjacentToHive(board);
  }

  // From each player's second placement on: must touch own color, not enemy.
  return emptyCellsAdjacentToHive(board).filter((c) => {
    let ownAdj = false;
    let enemyAdj = false;
    for (const n of neighbors(c)) {
      const top = topPieceAt(board, n);
      if (!top) continue;
      if (top.color === color) ownAdj = true;
      else enemyAdj = true;
    }
    return ownAdj && !enemyAdj;
  });
};
