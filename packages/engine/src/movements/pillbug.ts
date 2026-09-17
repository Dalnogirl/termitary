import { type Board, isEmpty, stackAt, topPieceAt } from '../board.js';
import { type HexCoord, neighbors, sharedNeighbors } from '../hex.js';
import { isConnectedWithout } from '../occupancy.js';
import type { Piece } from '../piece.js';
import type { MovementFn } from './index.js';
import { queenMovement } from './queen.js';

/** A piece at `from` lifted over the pillbug and set down at `to`. */
export type Throw = { readonly from: HexCoord; readonly to: HexCoord };

/** One space at a time, exactly the queen. The ability is the whole piece. */
export const pillbugMovement: MovementFn = queenMovement;

/**
 * Both halves of a throw climb to the pillbug's own height and back down, so
 * the gap is too narrow only when both shared neighbours are stacks. A single
 * piece is level with the pillbug and can be passed over.
 */
const gateBlocked = (board: Board, a: HexCoord, b: HexCoord): boolean =>
  sharedNeighbors(a, b).every((g) => stackAt(board, g).length > 1);

/**
 * The throw belongs to the pillbug and to any mosquito standing beside one. A
 * covered pillbug is not a neighbour to copy, the same way it is no longer a
 * thrower itself.
 */
export const hasThrowAbility = (piece: Piece, at: HexCoord, board: Board): boolean =>
  piece.type === 'pillbug' ||
  (piece.type === 'mosquito' &&
    neighbors(at).some((n) => topPieceAt(board, n)?.type === 'pillbug'));

/**
 * Every piece this pillbug can throw and where it can put it. Geometry only:
 * the stun is a property of the history rather than the board, so the
 * coordinator filters for it.
 */
export const pillbugThrows = (pillbug: HexCoord, board: Board): Throw[] => {
  // Something on top pins the pillbug's back and the ability with it.
  if (stackAt(board, pillbug).length !== 1) return [];

  const ring = neighbors(pillbug);
  const targets = ring.filter((n) => isEmpty(board, n) && !gateBlocked(board, pillbug, n));
  if (targets.length === 0) return [];

  const throws: Throw[] = [];
  for (const from of ring) {
    if (stackAt(board, from).length !== 1) continue;
    if (!isConnectedWithout(board, from)) continue;
    if (gateBlocked(board, from, pillbug)) continue;
    for (const to of targets) throws.push({ from, to });
  }
  return throws;
};
