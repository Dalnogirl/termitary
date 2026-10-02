// @vitest-environment jsdom
import { createGame } from '@termitary/engine';
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameStore } from '../store/store.js';
import { startOf } from './demo.js';
import { goal } from './goal.js';
import { BEAT_MS } from './player.js';
import { useDemoPlayer } from './use-demo-player.js';

const render = () => renderHook(() => useDemoPlayer(goal), { wrapper: StrictMode });
const historyLength = () => gameStore.getState().liveGame.history.length;

describe('useDemoPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('autoplays through the StrictMode remount', () => {
    const { result, unmount } = render();
    expect(result.current.mode).toBe('watching');

    act(() => vi.advanceTimersByTime(BEAT_MS * goal.script.length));
    expect(historyLength()).toBe(goal.setup.length + 1);
    unmount();
  });

  it('hands the start position over on try it, and takes it back on watch', () => {
    const { result, unmount } = render();
    act(() => vi.advanceTimersByTime(BEAT_MS * goal.script.length));

    act(() => result.current.tryIt());
    expect(result.current.mode).toBe('trying');
    expect(gameStore.getState().liveGame).toEqual(startOf(goal));
    act(() => vi.advanceTimersByTime(BEAT_MS * goal.script.length));
    expect(historyLength()).toBe(goal.setup.length);

    act(() => result.current.watch());
    expect(result.current.mode).toBe('watching');
    unmount();
  });

  it('leaves an empty board behind', () => {
    const { unmount } = render();
    unmount();
    expect(gameStore.getState().liveGame).toEqual(createGame());
  });
});
