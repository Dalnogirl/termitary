import { isEmpty } from '../board.js';
import { neighbors } from '../hex.js';
import { canSlide } from '../occupancy.js';
import type { MovementFn } from './index.js';

export const queenMovement: MovementFn = (from, board) =>
  neighbors(from).filter((n) => isEmpty(board, n) && canSlide(board, from, n));
