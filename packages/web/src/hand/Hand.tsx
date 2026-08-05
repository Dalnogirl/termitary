import { useSyncExternalStore } from 'react';
import type { Color, PieceType } from '@hive/engine';
import { pieceLetter } from '../board/pieces.js';
import { handlePassClick } from '../controller/input.js';
import { getState, setSelection, subscribe } from '../store/store.js';

const PIECE_ORDER: readonly PieceType[] = ['queen', 'ant', 'beetle', 'spider', 'grasshopper'];
const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };

const useStore = () => useSyncExternalStore(subscribe, getState, getState);

type Props = { readonly color: Color };

export const Hand = ({ color }: Props) => {
  const state = useStore();
  const isActive = state.game.status === 'in_progress' && state.game.currentPlayer === color;
  const hand = state.game.hands[color];

  const hasPlacement = (type: PieceType): boolean =>
    state.validMoves.some(
      (m) => m.kind === 'place' && m.piece.type === type && m.piece.color === color,
    );

  const passOnly =
    isActive && state.validMoves.length === 1 && state.validMoves[0]?.kind === 'pass';

  const onSlotClick = (type: PieceType): void => {
    if (!isActive) return;
    const cur = state.selection;
    if (cur?.kind === 'hand' && cur.piece === type) {
      setSelection(null);
    } else {
      setSelection({ kind: 'hand', piece: type });
    }
  };

  return (
    <div className={`hand-strip hand-${color}${isActive ? ' active' : ''}`}>
      <span className="hand-label">{COLOR_LABEL[color]}</span>
      <div className="hand-slots">
        {PIECE_ORDER.map((type) => {
          const count = hand[type];
          const enabled = count > 0 && isActive && hasPlacement(type);
          const isSelected =
            isActive && state.selection?.kind === 'hand' && state.selection.piece === type;
          return (
            <button
              key={type}
              type="button"
              className={`hand-slot${isSelected ? ' selected' : ''}`}
              disabled={!enabled}
              onClick={() => onSlotClick(type)}
            >
              <span className="hand-letter">{pieceLetter(type)}</span>
              <span className="hand-count">{count}</span>
            </button>
          );
        })}
      </div>
      {passOnly && (
        <button type="button" className="pass-btn" onClick={handlePassClick}>
          Pass turn (no moves available)
        </button>
      )}
    </div>
  );
};
