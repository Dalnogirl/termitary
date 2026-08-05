import { IllegalMoveError, type Move, applyMove } from '@hive/engine';
import { toast } from 'sonner';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

export const createLocalController = (): Controller => ({
  commitMove: (move: Move): void => {
    const { game, applyGameState, setSelection } = gameStore.getState();
    try {
      applyGameState(applyMove(game, move));
    } catch (e) {
      if (e instanceof IllegalMoveError) {
        toast.error(e.message);
        setSelection(null);
        return;
      }
      throw e;
    }
  },
});
