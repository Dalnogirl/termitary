import { IllegalMoveError, type Move, applyMove } from '@hive/engine';
import { commit, getState, setSelection } from '../store/store.js';
import type { Controller } from './port.js';

export const createLocalController = (): Controller => ({
  commitMove: (move: Move): void => {
    const state = getState();
    try {
      commit(applyMove(state.game, move));
    } catch (e) {
      if (e instanceof IllegalMoveError) {
        console.warn('IllegalMoveError:', e.message);
        setSelection(null);
        return;
      }
      throw e;
    }
  },
});
