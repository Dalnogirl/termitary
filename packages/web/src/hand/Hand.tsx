import { useSyncExternalStore } from 'react';
import type { Color, PieceType } from '@hive/engine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pieceLetter } from '../board/pieces.js';
import { useInputHandlers } from '../controller/InputProvider.js';
import { getState, setSelection, subscribe } from '../store/store.js';

const PIECE_ORDER: readonly PieceType[] = ['queen', 'ant', 'beetle', 'spider', 'grasshopper'];
const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };

const useStore = () => useSyncExternalStore(subscribe, getState, getState);

type Props = { readonly color: Color };

const slotBase =
  'inline-flex flex-col items-center justify-center w-14 h-14 rounded-md font-bold transition-all ' +
  'disabled:opacity-30 disabled:pointer-events-none cursor-pointer';

const slotPalette: Record<Color, string> = {
  white: 'bg-foreground text-background hover:bg-foreground/90',
  black: 'bg-card text-foreground border border-border hover:bg-card/70',
};

export const Hand = ({ color }: Props) => {
  const state = useStore();
  const { handlePassClick } = useInputHandlers();
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
    <div
      className={cn(
        'flex items-center gap-4 px-5 py-3 min-h-20 transition-colors border-y-2',
        isActive ? 'border-foreground bg-muted' : 'border-transparent bg-background',
      )}
    >
      <span
        className={cn(
          'min-w-15 text-xs uppercase tracking-[0.15em]',
          isActive ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {COLOR_LABEL[color]}
      </span>
      <div className="flex gap-2">
        {PIECE_ORDER.map((type) => {
          const count = hand[type];
          const enabled = count > 0 && isActive && hasPlacement(type);
          const isSelected =
            isActive && state.selection?.kind === 'hand' && state.selection.piece === type;
          return (
            <button
              key={type}
              type="button"
              className={cn(
                slotBase,
                slotPalette[color],
                isSelected && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
              )}
              disabled={!enabled}
              onClick={() => onSlotClick(type)}
            >
              <span className="text-lg leading-none">{pieceLetter(type)}</span>
              <span className="text-[10px] opacity-75 mt-0.5">{count}</span>
            </button>
          );
        })}
      </div>
      {passOnly && (
        <Button onClick={handlePassClick} className="ml-auto" size="sm">
          Pass turn (no moves available)
        </Button>
      )}
    </div>
  );
};
