import { remove, stackAt } from '../board.js';
import { neighbors } from '../hex.js';
import { canSlide } from '../occupancy.js';
import type { MovementFn } from './index.js';
import { hasOccupiedNeighbor } from './utils.js';

export const beetleMovement: MovementFn = (from, board) => {
  const fromHeight = stackAt(board, from).length;
  const transit = remove(board, from);
  return neighbors(from).filter((n) => {
    const toHeightAfter = stackAt(transit, n).length;

    // Climbing onto an occupied target: hive presence trivially satisfied.
    // (Height-aware squeeze across stacks is deferred — see step 5 notes.)
    if (toHeightAfter > 0) return true;

    // Empty target: must stay touching the hive after the move.
    if (!hasOccupiedNeighbor(transit, n)) return false;

    // Ground-only canSlide: source-stack > 1 means descending from a stack,
    // squeeze rule bypassed.
    const sourceWasGround = fromHeight === 1;
    return sourceWasGround ? canSlide(transit, from, n) : true;
  });
};
