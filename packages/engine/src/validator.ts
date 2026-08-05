import { type Board, topPieceAt } from './board.js';
import type { HexCoord } from './hex.js';
import { movements } from './movements/index.js';
import { isConnectedWithout } from './occupancy.js';
import type { Piece } from './piece.js';

export const getValidMoves = (piece: Piece, from: HexCoord, board: Board): HexCoord[] => {
  const top = topPieceAt(board, from);
  if (!top || top.type !== piece.type || top.color !== piece.color) return [];
  if (!isConnectedWithout(board, from)) return [];
  const fn = (movements as Partial<Record<typeof piece.type, (typeof movements)['queen']>>)[
    piece.type
  ];
  return fn ? fn(from, board) : [];
};
