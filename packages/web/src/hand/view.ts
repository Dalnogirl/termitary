import type { Color, PieceType } from '@hive/engine';
import { type StoreState, getState, setSelection, subscribe } from '../store/store.js';
import { pieceLetter } from '../board/pieces.js';

const PIECE_ORDER: readonly PieceType[] = ['queen', 'ant', 'beetle', 'spider', 'grasshopper'];

const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };

export type HandView = {
  destroy: () => void;
};

type Slot = { btn: HTMLButtonElement; countEl: HTMLSpanElement };

export const createHandView = (container: HTMLElement, color: Color): HandView => {
  container.classList.add('hand-strip', `hand-${color}`);

  const label = document.createElement('span');
  label.className = 'hand-label';
  label.textContent = COLOR_LABEL[color];

  const slotsEl = document.createElement('div');
  slotsEl.className = 'hand-slots';

  const slots = new Map<PieceType, Slot>();

  for (const type of PIECE_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'hand-slot';
    btn.dataset.type = type;

    const letter = document.createElement('span');
    letter.className = 'hand-letter';
    letter.textContent = pieceLetter(type);

    const countEl = document.createElement('span');
    countEl.className = 'hand-count';

    btn.append(letter, countEl);
    btn.addEventListener('click', () => {
      const s = getState();
      if (s.game.currentPlayer !== color) return;
      const cur = s.selection;
      if (cur?.kind === 'hand' && cur.piece === type) {
        setSelection(null);
      } else {
        setSelection({ kind: 'hand', piece: type });
      }
    });

    slotsEl.appendChild(btn);
    slots.set(type, { btn, countEl });
  }

  container.append(label, slotsEl);

  const render = (state: StoreState): void => {
    const isActive = state.game.status === 'in_progress' && state.game.currentPlayer === color;
    container.classList.toggle('active', isActive);

    const hand = state.game.hands[color];
    const hasPlacement = (type: PieceType): boolean =>
      state.validMoves.some(
        (m) => m.kind === 'place' && m.piece.type === type && m.piece.color === color,
      );

    for (const type of PIECE_ORDER) {
      const slot = slots.get(type);
      if (!slot) continue;
      const count = hand[type];
      slot.countEl.textContent = String(count);
      slot.btn.disabled = !(count > 0 && isActive && hasPlacement(type));
      const isSelected =
        isActive &&
        state.selection?.kind === 'hand' &&
        state.selection.piece === type;
      slot.btn.classList.toggle('selected', isSelected);
    }
  };

  const unsubscribe = subscribe(render);
  render(getState());

  const destroy = (): void => {
    unsubscribe();
    container.replaceChildren();
  };

  return { destroy };
};
