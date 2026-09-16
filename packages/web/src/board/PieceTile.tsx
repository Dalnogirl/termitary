import { cn } from '@/lib/utils';
import type { Color, PieceType } from '@termitary/engine';
import { PieceMark } from './PieceMark.js';

// Only the dark tile carries an edge, so it is an inset ring rather than a
// border: a ring paints inside the box and cannot measure differently from the
// tile beside it.
const tileClass: Record<Color, string> = {
  white: 'bg-(--piece-white-fill)',
  black: 'bg-(--piece-black-fill) inset-ring-1 inset-ring-border',
};

type Props = {
  readonly type: PieceType;
  readonly color: Color;
};

/** A piece on its own square, for the places outside a game that show one. */
export const PieceTile = ({ type, color }: Props) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
      tileClass[color],
    )}
  >
    <PieceMark type={type} color={color} size={30} />
  </span>
);
