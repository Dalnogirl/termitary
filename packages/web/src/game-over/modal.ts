import { type StoreState, getState, reset, subscribe } from '../store/store.js';

export type GameOverModal = {
  destroy: () => void;
};

type FinishedResult = 'white-wins' | 'black-wins' | 'draw';

const RESULT_TEXT: Record<FinishedResult, { title: string; subtitle: string }> = {
  'white-wins': { title: 'White wins', subtitle: 'Black queen surrounded' },
  'black-wins': { title: 'Black wins', subtitle: 'White queen surrounded' },
  draw: { title: 'Draw', subtitle: 'Both queens surrounded simultaneously' },
};

export const createGameOverModal = (container: HTMLElement): GameOverModal => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'none';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h2');
  title.className = 'modal-title';

  const subtitle = document.createElement('p');
  subtitle.className = 'modal-subtitle';

  const cta = document.createElement('button');
  cta.className = 'modal-cta';
  cta.textContent = 'New game';
  cta.addEventListener('click', () => reset());

  modal.append(title, subtitle, cta);
  overlay.append(modal);
  container.append(overlay);

  const render = (state: StoreState): void => {
    if (state.game.status !== 'finished') {
      overlay.style.display = 'none';
      return;
    }
    const { title: t, subtitle: s } = RESULT_TEXT[state.game.result];
    title.textContent = t;
    subtitle.textContent = s;
    overlay.style.display = 'flex';
  };

  const unsubscribe = subscribe(render);
  render(getState());

  const destroy = (): void => {
    unsubscribe();
    overlay.remove();
  };

  return { destroy };
};
