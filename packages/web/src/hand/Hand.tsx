import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Color, PieceType } from '@termitary/engine';
import { PieceMark } from '../board/PieceMark.js';
import { useInputHandlers } from '../controller/InputProvider.js';
import { useRoomContext } from '../controller/RoomContext.js';
import { useGameStore } from '../store/store.js';

const PIECE_ORDER: readonly PieceType[] = ['queen', 'ant', 'beetle', 'spider', 'grasshopper'];
const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };

type Props = {
  readonly color: Color;
  readonly edge: 'top' | 'bottom';
};

const edgeAnchor: Record<Props['edge'], string> = {
  top: 'top-3 md:top-5',
  bottom: 'bottom-3 md:bottom-5',
};

const slotBase =
  'inline-flex flex-col items-center justify-center w-11 h-11 md:w-14 md:h-14 rounded-xl font-bold transition-all ' +
  'disabled:opacity-30 disabled:pointer-events-none cursor-pointer';

const slotPalette: Record<Color, string> = {
  white: 'bg-(--piece-white-fill) text-[#3a352b] shadow-sm hover:brightness-95',
  black:
    'bg-(--piece-black-fill) text-foreground border border-border shadow-sm hover:brightness-125',
};

export const Hand = ({ color, edge }: Props) => {
  const game = useGameStore((s) => s.view);
  const validMoves = useGameStore((s) => s.validMoves);
  const selection = useGameStore((s) => s.selection);
  const setSelection = useGameStore((s) => s.setSelection);
  const { handlePassClick } = useInputHandlers();
  const { myColor } = useRoomContext();
  // myColor null = hot-seat (this client controls both sides). When set,
  // only the matching hand can act regardless of whose turn it is.
  const controllable = myColor === null || myColor === color;
  const isActive = game.status === 'in_progress' && game.currentPlayer === color && controllable;
  const hand = game.hands[color];

  const hasPlacement = (type: PieceType): boolean =>
    validMoves.some((m) => m.kind === 'place' && m.piece.type === type && m.piece.color === color);

  const passOnly = isActive && validMoves.length === 1 && validMoves[0]?.kind === 'pass';

  const onSlotClick = (type: PieceType): void => {
    if (!isActive) return;
    if (selection?.kind === 'hand' && selection.piece === type) {
      setSelection(null);
    } else {
      setSelection({ kind: 'hand', piece: type });
    }
  };

  return (
    <div
      className={cn(
        'glass-island absolute left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-1.5rem)]',
        'flex items-center gap-2 md:gap-4 px-3 md:px-5 py-2 md:py-3 rounded-3xl',
        'transition-[opacity,transform,box-shadow] duration-300',
        edgeAnchor[edge],
        isActive
          ? 'opacity-100 ring-2 ring-foreground/70'
          : 'opacity-70 scale-[0.97] hover:opacity-100',
      )}
    >
      <span
        className={cn(
          'hidden md:inline min-w-15 text-xs uppercase tracking-[0.15em]',
          isActive ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {COLOR_LABEL[color]}
      </span>
      <div className="flex gap-1.5 md:gap-2">
        {PIECE_ORDER.map((type) => {
          const count = hand[type] ?? 0;
          const enabled = count > 0 && isActive && hasPlacement(type);
          const isSelected = isActive && selection?.kind === 'hand' && selection.piece === type;
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
              // The glyph is decorative, so without this the slot announces as
              // a bare count.
              aria-label={`${type}, ${count} in hand`}
              onClick={() => onSlotClick(type)}
            >
              <PieceMark type={type} color={color} size={26} />
              <span className="text-[10px] opacity-75 mt-0.5">{count}</span>
            </button>
          );
        })}
      </div>
      {passOnly && (
        <Button onClick={handlePassClick} size="sm" className="shrink-0">
          <span className="md:hidden">Pass</span>
          <span className="hidden md:inline">Pass turn (no moves available)</span>
        </Button>
      )}
    </div>
  );
};
