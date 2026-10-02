import { IllegalMoveError, type Move, applyMove } from '@termitary/engine';
import type { Notifier } from '../lib/notify.js';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

type Options = {
  readonly notifier: Notifier;
};

export const createLocalController = ({ notifier }: Options): Controller => ({
  commitMove: (move: Move): void => {
    const { liveGame, applyGameState, setSelection } = gameStore.getState();
    try {
      applyGameState(applyMove(liveGame, move));
    } catch (e) {
      if (e instanceof IllegalMoveError) {
        notifier.error(e.message);
        setSelection(null);
        return;
      }
      throw e;
    }
  },
});
