// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameStore } from '../store/store.js';
import { startOf } from './demo.js';
import { goal } from './goal.js';
import { playScript } from './player.js';

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

    vi.advanceTimersByTime(1200 * goal.script.length);
    expect(historyLength()).toBe(goal.setup.length + 1);

    vi.advanceTimersByTime(1200);
    expect(gameStore.getState().liveGame).toBe(start);
    expect(onInterrupted).not.toHaveBeenCalled();
    stop();
  });

  it('plays nothing more once stopped', () => {
    const onInterrupted = vi.fn();
    const stop = playScript(goal, start, onInterrupted);
    stop();

    gameStore.getState().setSelection({ kind: 'board', coord: { q: 0, r: 1 } });
    vi.advanceTimersByTime(1200 * goal.script.length);
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

    vi.advanceTimersByTime(1200 * goal.script.length);
    expect(historyLength()).toBe(goal.setup.length);
  });
});
