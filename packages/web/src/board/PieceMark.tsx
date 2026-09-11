import type { Color, PieceType } from '@hive/engine';
import { usePrefsStore } from '../store/prefs.js';
import { type PieceSet, markFor } from './piece-sets.js';
import { type PieceHue, pieceInk } from './pieces.js';

type Props = {
  readonly type: PieceType;
  readonly color: Color;
  /** Side of the square the mark is fitted into, in pixels. */
  readonly size: number;
  /** Overrides the player's preferences, for previewing ones they have not chosen. */
  readonly set?: PieceSet;
  readonly hue?: PieceHue;
};

/** The DOM render path for a piece mark: the hand, and anywhere else outside a canvas. */
export const PieceMark = ({ type, color, size, set, hue }: Props) => {
  const preferredSet = usePrefsStore((s) => s.pieceSet);
  const preferredHue = usePrefsStore((s) => s.pieceHue);
  const ink = pieceInk(type, color, hue ?? preferredHue);
  const mark = markFor(set ?? preferredSet, type, size / 2);

  // A slot is square rather than hexagonal, so a letter is sized to the box
  // instead of to the hexagon a tile would inscribe, and centred by the line
  // box rather than by the mark's measured baseline.
  if (mark.kind === 'text') {
    return (
      <span className="font-bold leading-none" style={{ color: ink, fontSize: size * 0.7 }}>
        {mark.text}
      </span>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g
        transform={`translate(${size / 2} ${size / 2}) scale(${mark.scale}) translate(${-mark.cx} ${-mark.cy})`}
      >
        {mark.shapes.map((shape) =>
          shape.kind === 'fill' ? (
            <path key={shape.d} d={shape.d} fill={ink} />
          ) : (
            <path
              key={shape.d}
              d={shape.d}
              fill="none"
              stroke={ink}
              strokeWidth={shape.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
      </g>
    </svg>
  );
};
