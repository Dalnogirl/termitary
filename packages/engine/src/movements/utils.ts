import { type Board, isEmpty } from '../board.js';
import { type HexCoord, key, neighbors } from '../hex.js';
import { canSlide } from '../occupancy.js';
import type { RouteFn } from './index.js';

/** Is `c` adjacent to at least one occupied cell on the given board? */
export const hasOccupiedNeighbor = (board: Board, c: HexCoord): boolean =>
  neighbors(c).some((n) => !isEmpty(board, n));

/**
 * Cells reachable in one sliding step from `from` on the given board.
 *
 * A valid sliding step requires:
 *   1. target is empty
 *   2. canSlide(board, from, target) — Hive freedom-of-movement
 *   3. target is adjacent to at least one occupied cell — the moving piece
 *      must stay touching the hive
 *
 * Caller is responsible for passing a "transit" board with the moving piece
 * already removed (matters for multi-step pieces and the touching check).
 */
export const slideStep = (board: Board, from: HexCoord): HexCoord[] =>
  neighbors(from).filter(
    (n) => isEmpty(board, n) && canSlide(board, from, n) && hasOccupiedNeighbor(board, n),
  );

/** The route of a piece that slides one cell and stops. */
export const oneStepRoute: RouteFn = (transit, from, to) =>
  slideStep(transit, from).some((n) => key(n) === key(to)) ? [from, to] : null;
