import { type Board, occupiedCells } from './board.js';
import { type HexCoord, key, neighbors } from './hex.js';
import type { Color } from './piece.js';

export type GameResult = 'white-wins' | 'black-wins' | 'draw' | 'ongoing';

const findQueenCell = (board: Board, color: Color): HexCoord | undefined => {
  for (const [c, stack] of occupiedCells(board)) {
    if (stack.some((p) => p.type === 'queen' && p.color === color)) return c;
  }
  return undefined;
};

export const isQueenSurrounded = (board: Board, color: Color): boolean => {
  const cell = findQueenCell(board, color);
  if (!cell) return false;
  return neighbors(cell).every((n) => board.cells.has(key(n)));
};

export const getResult = (board: Board): GameResult => {
  const whiteDown = isQueenSurrounded(board, 'white');
  const blackDown = isQueenSurrounded(board, 'black');
  if (whiteDown && blackDown) return 'draw';
  if (whiteDown) return 'black-wins';
  if (blackDown) return 'white-wins';
  return 'ongoing';
};
