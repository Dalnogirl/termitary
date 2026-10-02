import { useEffect } from 'react';
import { notifier } from '../lib/notify.js';
import { useGameStore } from '../store/store.js';

export const useReplayFailedToast = (): void => {
  const replayFailed = useGameStore((s) => s.replayFailed);

  useEffect(() => {
    if (replayFailed) {
      notifier.error('This game’s history could not be rebuilt', { id: 'replay-failed' });
    }
  }, [replayFailed]);
};
