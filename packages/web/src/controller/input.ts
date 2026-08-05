import { type HexCoord, IllegalMoveError, applyMove } from '@hive/engine';
import { commit, getState, setSelection } from '../store/store.js';

export const handleTargetClick = (coord: HexCoord): void => {
  const state = getState();
  if (state.game.status !== 'in_progress') return;
  const sel = state.selection;
  if (sel?.kind !== 'hand') return;

  const player = state.game.currentPlayer;
  const move = state.validMoves.find(
    (m) =>
      m.kind === 'place' &&
      m.piece.type === sel.piece &&
      m.piece.color === player &&
      m.to.q === coord.q &&
      m.to.r === coord.r,
  );
  if (!move) return;

  try {
    commit(applyMove(state.game, move));
  } catch (e) {
    if (e instanceof IllegalMoveError) {
      console.warn('IllegalMoveError despite validMoves filter:', e.message);
      setSelection(null);
      return;
    }
    throw e;
  }
};
