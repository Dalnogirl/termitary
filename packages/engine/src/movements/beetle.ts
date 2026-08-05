import { stackAt } from '../board.js';
import { neighbors } from '../hex.js';
import { canSlide } from '../occupancy.js';
import type { MovementFn } from './index.js';

export const beetleMovement: MovementFn = (from, board) => {
  const fromHeight = stackAt(board, from).length;
  return neighbors(from).filter((n) => {
    const toHeight = stackAt(board, n).length;
    // Squeeze rule applies only at pure ground level (both source-after-removal
    // and target at height 0). Climbing or descending bypasses the check.
    // TODO: full height-aware squeeze (squeeze iff both gates >= max(source-after, target))
    // is deferred; this misses the rare "between two tall stacks at ground" case.
    const groundLevel = fromHeight === 1 && toHeight === 0;
    return groundLevel ? canSlide(board, from, n) : true;
  });
};
