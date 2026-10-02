// @vitest-environment jsdom

import { type GameState, applyMove, createGame, listValidMoves } from '@termitary/engine';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifier } from '../lib/notify.js';
import { gameStore } from '../store/store.js';
import { useReplayFailedToast } from './use-replay-failed-toast.js';

// The same placement twice: a history the engine refuses to replay.
const unreplayable = (): GameState => {
  const start = createGame();
  const first = listValidMoves(start)[0];
  if (first === undefined) throw new Error('no opening move');
  const afterFirst = applyMove(start, first);
  return { ...afterFirst, history: [first, first] };
};

beforeEach(() => {
  gameStore.getState().reset();
  vi.spyOn(notifier, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useReplayFailedToast', () => {
  it('toasts once per failure, under one id', () => {
    renderHook(() => useReplayFailedToast());
    act(() => gameStore.getState().applyGameState(unreplayable()));

    act(() => gameStore.getState().setViewIndex(1));
    act(() => gameStore.getState().setViewIndex(0));

    expect(notifier.error).toHaveBeenCalledOnce();
    expect(notifier.error).toHaveBeenCalledWith(expect.any(String), { id: 'replay-failed' });
  });

  it('toasts again after a fresh state fails to replay', () => {
    renderHook(() => useReplayFailedToast());
    const game = unreplayable();

    act(() => gameStore.getState().applyGameState(game));
    act(() => gameStore.getState().setViewIndex(1));
    act(() => gameStore.getState().applyGameState(game));
    act(() => gameStore.getState().setViewIndex(1));

    expect(notifier.error).toHaveBeenCalledTimes(2);
  });
});
