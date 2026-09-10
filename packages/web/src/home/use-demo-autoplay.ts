import { applyMove } from '@hive/engine';
import { type RefObject, useEffect } from 'react';
import { gameStore } from '../store/store.js';
import { createDemoPicker } from './demo-script.js';

// Applied before the first paint. An empty board is a bad first impression, and
// watching one fill up from nothing takes half a minute.
const PRELOADED_PLIES = 8;
const ANIMATED_PLIES = 10;
const PLY_MS = 1400;

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useDemoAutoplay = (surface: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const pick = createDemoPicker();
    gameStore.getState().reset();

    const step = (): boolean => {
      const { game, validMoves, applyGameState } = gameStore.getState();
      const move = pick(game, validMoves);
      if (move === undefined) return false;
      applyGameState(applyMove(game, move));
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

    // Touching the board is a takeover: a scripted move landing under the
    // visitor's cursor would fight them for the piece they just picked up.
    const el = surface.current;
    el?.addEventListener('pointerdown', stop, { capture: true });

    return () => {
      stop();
      el?.removeEventListener('pointerdown', stop, { capture: true });
    };
  }, [surface]);
};
