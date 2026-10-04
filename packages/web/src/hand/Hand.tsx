import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type Color, type PieceType, type Ruleset, rulesetPieceTypes } from '@termitary/engine';
import { PieceMark } from '../board/PieceMark.js';
import { PIECE_ORDER } from '../board/pieces.js';
import { useInputHandlers } from '../controller/InputProvider.js';
import { useRoomContext } from '../controller/RoomContext.js';
import { interaction, turnHolder } from '../controller/interaction.js';
import { useGameStore } from '../store/store.js';

const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };

// A ruleset is a plain object, so its key order is whatever literal built it.
// The hand reads left to right in the fixed display order instead.
const handSlots = (ruleset: Ruleset): readonly PieceType[] => {
  const dealt = new Set(rulesetPieceTypes(ruleset));
  return PIECE_ORDER.filter((type) => dealt.has(type));
};

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
  const selection = useGameStore((s) => s.selection);
  const { handleHandSlotClick, handlePassClick } = useInputHandlers();
  const { myColor } = useRoomContext();
  const hasTurn = useGameStore((s) => turnHolder(s, myColor)) === color;
  const can = useGameStore((s) => interaction(s, myColor));
  const acting = can.actor === color;
  const hand = game.hands[color];
  const slots = handSlots(game.ruleset);

  return (
    <div
      className={cn(
        'glass-island absolute left-1/2 -translate-x-1/2 z-20 w-max max-w-[calc(100%-1.5rem)]',
        'flex items-center gap-2 md:gap-4 px-3 md:px-5 py-2 md:py-3 rounded-3xl',
        'transition-[opacity,transform,box-shadow] duration-300',
        edgeAnchor[edge],
        hasTurn
          ? 'opacity-100 ring-2 ring-foreground/70'
          : 'opacity-70 scale-[0.97] hover:opacity-100',
      )}
    >
      <span
        className={cn(
          'hidden md:inline min-w-15 text-xs uppercase tracking-[0.15em]',
          hasTurn ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {COLOR_LABEL[color]}
      </span>
      <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
        {slots.map((type) => {
          const count = hand[type] ?? 0;
          const enabled = acting && can.placeable.has(type);
          const isSelected = acting && selection?.kind === 'hand' && selection.piece === type;
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
              onClick={() => handleHandSlotClick(color, type)}
            >
              <PieceMark type={type} color={color} size={26} />
              <span className="text-[10px] opacity-75 mt-0.5">{count}</span>
            </button>
          );
        })}
      </div>
      {acting && can.canPass && (
        <Button onClick={handlePassClick} size="sm" className="shrink-0">
          <span className="md:hidden">Pass</span>
          <span className="hidden md:inline">Pass turn (no moves available)</span>
        </Button>
      )}
    </div>
  );
};
