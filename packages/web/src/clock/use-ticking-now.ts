import { useEffect, useState } from 'react';

/**
 * `performance.now()`, refreshed every `intervalMs` while the tab is visible.
 * Null stops it. A hidden tab skips its ticks and reads the time afresh when
 * it comes back, since the displays derive from the time rather than count it.
 */
export const useTickingNow = (intervalMs: number | null): number => {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (intervalMs === null) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(performance.now());
    const sync = () => {
      clearInterval(id);
      id = undefined;
      if (document.hidden) return;
      tick();
      id = setInterval(tick, intervalMs);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [intervalMs]);

  return now;
};
