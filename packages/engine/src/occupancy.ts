import type { Board } from './board.js';
import { isEmpty } from './board.js';
import { type HexCoord, sharedNeighbors } from './hex.js';

export const canSlide = (board: Board, from: HexCoord, to: HexCoord): boolean =>
  sharedNeighbors(from, to).some((gate) => isEmpty(board, gate));
