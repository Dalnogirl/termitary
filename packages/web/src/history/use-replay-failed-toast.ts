import { useEffect } from 'react';
import { notifier } from '../lib/notify.js';
import { gameStore } from '../store/store.js';

// On the edge rather than the value: the store is module-level, so a flag left
// set by the previous page would otherwise toast again on mount.
export const useReplayFailedToast = (): void => {
  useEffect(
    () =>
      gameStore.subscribe((state, prev) => {
        if (state.replayFailed && !prev.replayFailed) {
          notifier.error('This game’s history could not be rebuilt', { id: 'replay-failed' });
        }
      }),
    [],
  );
};
