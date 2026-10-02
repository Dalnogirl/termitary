import { type GameState, applyMove } from '@termitary/engine';
import { annotationStore } from '../store/annotations.js';
import { gameStore } from '../store/store.js';
import type { DemoStep, RulesDemo } from './demo.js';

export const BEAT_MS = 600;

export const perform = (step: DemoStep): void => {
  const { liveGame, applyGameState, setSelection } = gameStore.getState();
  switch (step.kind) {
    case 'select':
      setSelection(step.selection);
      return;
    case 'annotate':
      annotationStore.getState().setAnnotations(step.annotations);
      return;
    case 'move':
      annotationStore.getState().clearAnnotations();
      applyGameState(applyMove(liveGame, step.move));
      return;
    case 'pause':
      return;
  }
};

/**
 * Deals `start` and walks the script on a timer, looping, until stopped. Any
 * store change the script did not make is the reader picking up a piece, which
 * hands them the board as it stands. Returns the stop function.
 */
export const playScript = (
  demo: RulesDemo,
  start: GameState,
  onInterrupted: () => void,
): (() => void) => {
  let scripted = false;
  const own = (change: () => void): void => {
    scripted = true;
    try {
      change();
    } finally {
      scripted = false;
    }
  };

  const deal = (): void => {
    annotationStore.getState().clearAnnotations();
    own(() => gameStore.getState().applyGameState(start));
  };

  let next = 0;
  let timer: number | undefined;

  const tick = (): void => {
    const step = demo.script[next];
    if (step === undefined) {
      deal();
      next = 0;
    } else {
      own(() => perform(step));
      next++;
    }
    timer = window.setTimeout(tick, BEAT_MS);
  };

  deal();
  timer = window.setTimeout(tick, BEAT_MS);

  // The marks explain the scripted position, which the reader is about to change.
  const stop = (): void => {
    window.clearTimeout(timer);
    unsubscribe();
    annotationStore.getState().clearAnnotations();
  };

  // A tap on empty board writes the null selection it already had, which is not
  // anyone taking over.
  const unsubscribe = gameStore.subscribe((state, prev) => {
    if (scripted) return;
    if (state.liveGame === prev.liveGame && state.selection === prev.selection) return;
    stop();
    onInterrupted();
  });

  return stop;
};
