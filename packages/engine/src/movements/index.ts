import type { Board } from '../board.js';
import type { HexCoord } from '../hex.js';
import type { PieceType } from '../piece.js';
import { queenMovement } from './queen.js';

export type MovementFn = (from: HexCoord, board: Board) => HexCoord[];

export const movements = {
  queen: queenMovement,
} satisfies Partial<Record<PieceType, MovementFn>>;
