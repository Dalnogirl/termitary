import { useEffect } from 'react';
import { gameStore, isLive } from '../store/store.js';

// Bound to the window rather than to the drawer: the history can be closed and
// the arrows must still step.
export const useHistoryKeys = (): void => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const state = gameStore.getState();
      switch (e.key) {
        case 'ArrowLeft':
          state.setViewIndex(state.viewIndex - 1);
          break;
        case 'ArrowRight':
          state.setViewIndex(state.viewIndex + 1);
          break;
        case 'ArrowUp':
        case 'Home':
          state.setViewIndex(0);
          break;
        case 'ArrowDown':
        case 'End':
          state.returnToLive();
          break;
        case 'Escape':
          // Live, Escape belongs to the drawer, which closes on it.
          if (isLive(state)) return;
          state.returnToLive();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
