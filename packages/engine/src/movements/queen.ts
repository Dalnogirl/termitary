import { remove } from '../board.js';
import type { MovementFn, RouteFn } from './index.js';
import { oneStepRoute, slideStep } from './utils.js';

export const queenMovement: MovementFn = (from, board) => slideStep(remove(board, from), from);

export const queenRoute: RouteFn = oneStepRoute;
