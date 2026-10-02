// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { annotationStore } from '../store/annotations.js';
import { gameStore } from '../store/store.js';
import { type RulesDemo, startOf } from './demo.js';
import { goal } from './goal.js';
import { place } from './moves.js';
import { BEAT_MS, playScript } from './player.js';

describe('playScript', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    gameStore.getState().reset();
  });

  const start = startOf(goal);
  const historyLength = () => gameStore.getState().liveGame.history.length;

  it('deals the start, plays the script, then loops back', () => {
    const onInterrupted = vi.fn();
    const stop = playScript(goal, start, onInterrupted);
    expect(gameStore.getState().liveGame).toBe(start);

    vi.advanceTimersByTime(BEAT_MS * goal.script.length);
    expect(historyLength()).toBe(goal.setup.length + 1);

    vi.advanceTimersByTime(BEAT_MS);
    expect(gameStore.getState().liveGame).toBe(start);
    expect(onInterrupted).not.toHaveBeenCalled();
    stop();
  });

  it('plays nothing more once stopped', () => {
    const onInterrupted = vi.fn();
    const stop = playScript(goal, start, onInterrupted);
    stop();

    gameStore.getState().setSelection({ kind: 'board', coord: { q: 0, r: 1 } });
    vi.advanceTimersByTime(BEAT_MS * goal.script.length);
    expect(onInterrupted).not.toHaveBeenCalled();
    expect(historyLength()).toBe(goal.setup.length);
  });

  it('keeps playing through a write that changes nothing', () => {
    const onInterrupted = vi.fn();
    const stop = playScript(goal, start, onInterrupted);

    gameStore.getState().setSelection(null);
    expect(onInterrupted).not.toHaveBeenCalled();
    stop();
  });

  it('hands the board over when something else touches the store', () => {
    const onInterrupted = vi.fn();
    playScript(goal, start, onInterrupted);

    gameStore.getState().setSelection({ kind: 'board', coord: { q: 0, r: 1 } });
    expect(onInterrupted).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(BEAT_MS * goal.script.length);
    expect(historyLength()).toBe(goal.setup.length);
  });

  describe('annotations', () => {
    const pin = { kind: 'pinned', at: { q: 0, r: 0 } } as const;
    const marked: RulesDemo = {
      ...goal,
      setup: [place('queen', 'white', 0, 0)],
      script: [
        { kind: 'annotate', annotations: [pin] },
        { kind: 'move', move: place('queen', 'black', 1, 0) },
        { kind: 'annotate', annotations: [pin] },
      ],
    };
    const marks = () => annotationStore.getState().annotations;

    it('sets marks, clears them on the next move and on the loop back', () => {
      const stop = playScript(marked, startOf(marked), vi.fn());
      vi.advanceTimersByTime(BEAT_MS);
      expect(marks()).toEqual([pin]);
      vi.advanceTimersByTime(BEAT_MS);
      expect(marks()).toEqual([]);
      vi.advanceTimersByTime(BEAT_MS);
      expect(marks()).toEqual([pin]);
      vi.advanceTimersByTime(BEAT_MS);
      expect(marks()).toEqual([]);
      stop();
    });

    it('clears the marks when the reader takes over', () => {
      const onInterrupted = vi.fn();
      playScript(marked, startOf(marked), onInterrupted);
      vi.advanceTimersByTime(BEAT_MS);

      gameStore.getState().setSelection({ kind: 'board', coord: { q: 0, r: 0 } });
      expect(onInterrupted).toHaveBeenCalledOnce();
      expect(marks()).toEqual([]);
    });
  });
});
