import { remove } from '../board.js';
import type { MovementFn } from './index.js';
import { slideStep } from './utils.js';

export const queenMovement: MovementFn = (from, board) => slideStep(remove(board, from), from);
