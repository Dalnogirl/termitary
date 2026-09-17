import type { Move } from './coordinator.js';
import type { HexCoord } from './hex.js';

/**
 * The cell holding the piece that moved on the previous turn, which the rules
 * call stunned: for this one turn it cannot move, be thrown, or use the
 * pillbug's ability. Placing is not moving, so a piece just placed is not
 * stunned.
 *
 * The stun lasts a single turn, so the last move is the whole story and
 * `GameState` needs no field of its own to carry it.
 */
export const stunnedCell = (history: readonly Move[]): HexCoord | undefined => {
  const last = history.at(-1);
  if (last?.kind === 'relocate' || last?.kind === 'throw') return last.to;
  return undefined;
};
