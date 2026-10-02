import { useEffect, useMemo, useState } from 'react';
import { annotationStore } from '../store/annotations.js';
import { gameStore } from '../store/store.js';
import { type RulesDemo, startOf } from './demo.js';
import { playScript } from './player.js';

export type DemoMode = 'watching' | 'trying';

export type DemoPlayer = {
  readonly mode: DemoMode;
  /** Back to the demo's position with the board live. */
  readonly tryIt: () => void;
  readonly watch: () => void;
};

export const useDemoPlayer = (demo: RulesDemo): DemoPlayer => {
  const [mode, setMode] = useState<DemoMode>('watching');
  const start = useMemo(() => startOf(demo), [demo]);

  useEffect(() => {
    if (mode !== 'watching') return;
    return playScript(demo, start, () => setMode('trying'));
  }, [demo, start, mode]);

  // After the script's effect, so the script has stopped by the time it cleans
  // up: a reset it saw would read as the reader taking the board over. Leaves an
  // empty board behind, so the next page never opens on a demo.
  useEffect(
    () => () => {
      gameStore.getState().reset();
      annotationStore.getState().clearAnnotations();
    },
    [],
  );

  return {
    mode,
    // The script sees a change it did not make, stops itself and flips the mode.
    tryIt: () => {
      setMode('trying');
      gameStore.getState().applyGameState(start);
    },
    watch: () => setMode('watching'),
  };
};
