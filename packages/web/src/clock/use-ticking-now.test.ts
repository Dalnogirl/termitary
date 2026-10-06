// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTickingNow } from './use-ticking-now.js';

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useTickingNow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    setHidden(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('moves on every interval while visible', () => {
    const { result } = renderHook(() => useTickingNow(100));
    const start = result.current;

    advance(250);

    expect(result.current).toBe(start + 200);
  });

  it('holds still when stopped', () => {
    const { result } = renderHook(() => useTickingNow(null));
    const start = result.current;

    advance(1_000);

    expect(result.current).toBe(start);
  });

  it('skips ticks while hidden and reads the time afresh on return', () => {
    const { result } = renderHook(() => useTickingNow(100));
    const start = result.current;

    setHidden(true);
    advance(5_000);
    expect(result.current).toBe(start);

    setHidden(false);
    expect(result.current).toBe(start + 5_000);
    expect(vi.getTimerCount()).toBe(1);
  });
});
