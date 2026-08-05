import { useSyncExternalStore } from 'react';
import { getState, reset, subscribe } from '../store/store.js';

type FinishedResult = 'white-wins' | 'black-wins' | 'draw';

const RESULT_TEXT: Record<FinishedResult, { title: string; subtitle: string }> = {
  'white-wins': { title: 'White wins', subtitle: 'Black queen surrounded' },
  'black-wins': { title: 'Black wins', subtitle: 'White queen surrounded' },
  draw: { title: 'Draw', subtitle: 'Both queens surrounded simultaneously' },
};

const useStore = () => useSyncExternalStore(subscribe, getState, getState);

export const Modal = () => {
  const state = useStore();
  if (state.game.status !== 'finished') return null;
  const { title, subtitle } = RESULT_TEXT[state.game.result];
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        <button type="button" className="modal-cta" onClick={reset}>
          New game
        </button>
      </div>
    </div>
  );
};
