import { type GameState, type Move, applyMove, createGame } from './coordinator.js';
import type { Ruleset } from './ruleset.js';

/**
 * Every position the history passed through: `frames[0]` is the opening empty
 * board and `frames[i]` the position after `i` moves, so the length is one more
 * than the history's.
 *
 * The fold re-validates each move through `applyMove`, which is redundant for a
 * history this process produced and the only integrity check on one that
 * arrived over the wire. A tampered history throws `IllegalMoveError`.
 *
 * The ruleset has no default: replaying a game under rules it was not played
 * under is exactly the failure this argument exists to prevent.
 */
export const replayFrames = (history: readonly Move[], ruleset: Ruleset): readonly GameState[] => {
  let state = createGame(ruleset);
  const frames: GameState[] = [state];
  for (const move of history) {
    state = applyMove(state, move);
    frames.push(state);
  }
  return frames;
};
