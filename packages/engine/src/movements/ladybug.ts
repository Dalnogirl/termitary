import { type Board, isEmpty, remove } from '../board.js';
import { type HexCoord, key, neighbors, parse } from '../hex.js';
import type { MovementFn } from './index.js';

const occupiedNeighbors = (board: Board, c: HexCoord): HexCoord[] =>
  neighbors(c).filter((n) => !isEmpty(board, n));

/**
 * Two steps across the top of the hive, then one down into an empty cell.
 * Nothing up there is a slide, so no gate applies and a stack is crossed like
 * any other roof. (Height-aware squeeze on the way down is deferred, as it is
 * for the beetle.)
 *
 * No path bookkeeping, unlike the spider: the two roof steps need an occupied
 * cell and `transit` has emptied the origin, so a path cannot double back
 * through it. Only the landing needs the origin ruled out.
 */
export const ladybugMovement: MovementFn = (from, board) => {
  const transit = remove(board, from);
  const origin = key(from);
  const destinations = new Set<string>();

  for (const first of occupiedNeighbors(transit, from)) {
    for (const second of occupiedNeighbors(transit, first)) {
      for (const down of neighbors(second)) {
        const dk = key(down);
        if (dk === origin || !isEmpty(transit, down)) continue;
        destinations.add(dk);
      }
    }
  }

  return [...destinations].map(parse);
};
