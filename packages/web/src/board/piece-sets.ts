import type { PieceType } from '@termitary/engine';
import { type GlyphShape, glyphPlacement, glyphShapes } from './glyphs.js';
import { PIECE_FONT } from './metrics.js';
import { pieceLetter } from './pieces.js';

/**
 * What to draw for one piece, and where. Konva, Canvas2D and SVG each draw a
 * mark with their own primitives, so a set describes the mark rather than
 * drawing it — that is the only thing all three render paths share.
 */
export type Mark =
  | {
      readonly kind: 'shapes';
      readonly shapes: readonly GlyphShape[];
      /** Scale from the 100-unit authoring box to pixels. */
      readonly scale: number;
      /** The ink centre in box units, to draw the shapes about. */
      readonly cx: number;
      readonly cy: number;
    }
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly font: string;
      readonly fontSize: number;
      /**
       * How far below the centre to put the baseline anchor. Canvas centres the
       * em box, whose middle sits above the ink of a capital.
       */
      readonly dy: number;
    };

type PieceSetDef = {
  readonly name: string;
  readonly note: string;
  /** `hexSize` is the circumradius of the hexagon the mark sits on. */
  readonly mark: (type: PieceType, hexSize: number) => Mark;
};

// The letter's cap height lands at 37% of the tile at this ratio, which is where
// the hand-drawn glyphs sit too.
const LETTER_SIZE_RATIO = 1.05;

const MEASURE_FONT_SIZE = 100;
const letterShifts = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

// Measured rather than taken from the font's tables, because which ascent a
// browser uses for the em box middle is not something to guess. Text metrics
// scale linearly, so one measurement per letter covers every size.
const letterCentreShift = (letter: string, font: string): number => {
  const key = `${font}:${letter}`;
  const cached = letterShifts.get(key);
  if (cached !== undefined) return cached;
  if (measureCtx === null) measureCtx = document.createElement('canvas').getContext('2d');
  if (measureCtx === null) return 0;
  measureCtx.font = `bold ${MEASURE_FONT_SIZE}px ${font}`;
  measureCtx.textBaseline = 'middle';
  const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } =
    measureCtx.measureText(letter);
  const shift =
    Number.isFinite(ascent) && Number.isFinite(descent)
      ? (ascent - descent) / 2 / MEASURE_FONT_SIZE
      : 0;
  letterShifts.set(key, shift);
  return shift;
};

export const PIECE_SETS = {
  chunky: {
    name: 'Insects',
    note: 'A silhouette per piece, one hue each.',
    mark: (type, hexSize) => ({
      kind: 'shapes',
      shapes: glyphShapes(type),
      ...glyphPlacement(type, hexSize),
    }),
  },
  letters: {
    name: 'Letters',
    note: 'Initials in the same hues. Nothing to learn.',
    mark: (type, hexSize) => {
      const text = pieceLetter(type);
      const fontSize = hexSize * LETTER_SIZE_RATIO;
      return {
        kind: 'text',
        text,
        font: PIECE_FONT,
        fontSize,
        dy: letterCentreShift(text, PIECE_FONT) * fontSize,
      };
    },
  },
} satisfies Record<string, PieceSetDef>;

export type PieceSet = keyof typeof PIECE_SETS;

export const PIECE_SET_IDS = Object.keys(PIECE_SETS) as readonly PieceSet[];

export const isPieceSet = (value: unknown): value is PieceSet =>
  typeof value === 'string' && Object.hasOwn(PIECE_SETS, value);

export const markFor = (set: PieceSet, type: PieceType, hexSize: number): Mark =>
  PIECE_SETS[set].mark(type, hexSize);
