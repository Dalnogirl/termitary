import { applyMove } from '@hive/engine';
import { useEffect } from 'react';
import { gameStore } from '../store/store.js';
import { createDemoPicker } from './demo-script.js';

// Applied before the first paint. An empty board is a bad first impression, and
// watching one fill up from nothing takes half a minute.
const PRELOADED_PLIES = 8;
const ANIMATED_PLIES = 10;
const PLY_MS = 1400;

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useDemoAutoplay = (): void => {
  useEffect(() => {
    const pick = createDemoPicker();
    gameStore.getState().reset();

    let stepping = false;
    const step = (): boolean => {
      const { liveGame, validMoves, applyGameState } = gameStore.getState();
      const move = pick(liveGame, validMoves);
      if (move === undefined) return false;
      stepping = true;
      applyGameState(applyMove(liveGame, move));
      stepping = false;
      return true;
    };

    const upfront = reducedMotion() ? PRELOADED_PLIES + ANIMATED_PLIES : PRELOADED_PLIES;
    for (let i = 0; i < upfront; i++) {
      if (!step()) break;
    }

    let remaining = PRELOADED_PLIES + ANIMATED_PLIES - upfront;
    let timer: number | undefined;

    const stop = (): void => {
      remaining = 0;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    const tick = (): void => {
      if (remaining <= 0 || !step()) {
        stop();
        return;
      }
      remaining--;
      timer = window.setTimeout(tick, PLY_MS);
    };

    if (remaining > 0) timer = window.setTimeout(tick, PLY_MS);

    // Any store change we did not cause is the visitor picking up a piece, and
    // a scripted move landing mid-selection would fight them for it. Panning
    // and scrolling touch the board without touching the store, so they leave
    // the demo running.
    const unsubscribe = gameStore.subscribe(() => {
      if (!stepping) stop();
    });

    return () => {
      stop();
      unsubscribe();
    };
  }, []);
};
