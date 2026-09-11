import type { Color, Piece, PieceType } from '@hive/engine';
import type { CanvasTheme } from './theme.js';

/** Whether one tone serves both players, or each tile tone gets its own. */
export type PieceHue = 'shared' | 'per-tile';

export const PIECE_HUES: readonly PieceHue[] = ['shared', 'per-tile'];

export const isPieceHue = (value: unknown): value is PieceHue =>
  value === 'shared' || value === 'per-tile';

const LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  ant: 'A',
  beetle: 'B',
  spider: 'S',
  grasshopper: 'G',
};

// One hue per piece type, in the saturated mid register the physical tiles use,
// which is what lets a single tone sit on both an ivory tile and a black one.
// The deep tone is for 'per-tile', where the ivory side can afford a darker ink.
const PIECE_INK: Record<PieceType, { readonly light: string; readonly dark: string }> = {
  queen: { light: '#e8b41e', dark: '#8f6e05' },
  ant: { light: '#5aa7cf', dark: '#1d5f80' },
  beetle: { light: '#8b7fd0', dark: '#4a3392' },
  spider: { light: '#a46a3f', dark: '#5e3a1d' },
  grasshopper: { light: '#57b24b', dark: '#2f6b1f' },
};

export const pieceLetter = (type: PieceType): string => LETTERS[type];

export const pieceFill = (piece: Piece, theme: CanvasTheme): string =>
  piece.color === 'white' ? theme.pieceWhiteFill : theme.pieceBlackFill;

// 'shared' keeps one tone per piece across both players, so a piece is the same
// colour wherever it appears. 'per-tile' trades that for contrast: the deep tone
// on white's near-white tile, the light one on black's.
export const pieceInk = (type: PieceType, color: Color, hue: PieceHue): string =>
  PIECE_INK[type][hue === 'shared' || color === 'black' ? 'light' : 'dark'];

// The landing ghost is drawn on the board ground rather than on a tile, which is
// always the dark end.
export const pieceGhostInk = (type: PieceType): string => PIECE_INK[type].light;
