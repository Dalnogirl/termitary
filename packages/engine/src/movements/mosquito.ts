import { type Board, stackAt, topPieceAt } from '../board.js';
import { type HexCoord, key, neighbors, parse } from '../hex.js';
import type { PieceType } from '../piece.js';
import { beetleMovement } from './beetle.js';
import { movements } from './index.js';

/**
 * A function declaration where every other movement is an arrow: `movements`
 * reads this module and this module reads `movements`, and only a hoisted
 * binding survives that cycle whichever of the two is imported first.
 *
 * Copying no mosquito is what bounds the recursion, and it is rule text rather
 * than a guard: a mosquito beside nothing but mosquitoes has no move at all.
 */
export function mosquitoMovement(from: HexCoord, board: Board): HexCoord[] {
  // On a stack it is a beetle until it comes down, whatever it stands beside.
  if (stackAt(board, from).length > 1) return beetleMovement(from, board);

  const copied = new Set<PieceType>();
  for (const n of neighbors(from)) {
    const top = topPieceAt(board, n);
    if (top && top.type !== 'mosquito') copied.add(top.type);
  }

  const destinations = new Set<string>();
  for (const type of copied) {
    for (const to of movements[type](from, board)) destinations.add(key(to));
  }
  return [...destinations].map(parse);
}
