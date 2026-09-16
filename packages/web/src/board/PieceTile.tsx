import { cn } from '@/lib/utils';
import type { Color, PieceType } from '@termitary/engine';
import { PieceMark } from './PieceMark.js';

const tileClass: Record<Color, string> = {
  white: 'bg-(--piece-white-fill)',
  black: 'bg-(--piece-black-fill) border border-border',
};

const tileSize = { sm: 'size-5', md: 'size-9' } as const;
const markSize = { sm: 14, md: 30 } as const;

type Props = {
  readonly type: PieceType;
  readonly color: Color;
  /** Two `sm` tiles, overlapping by their corner, take the width of one `md`. */
  readonly size?: keyof typeof tileSize;
};

/** A piece on its own square, for the places outside a game that show one. */
export const PieceTile = ({ type, color, size = 'md' }: Props) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex items-center justify-center rounded-lg',
      tileSize[size],
      tileClass[color],
    )}
  >
    <PieceMark type={type} color={color} size={markSize[size]} />
  </span>
);
