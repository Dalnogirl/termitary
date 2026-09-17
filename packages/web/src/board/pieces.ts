import type { Color, Piece, PieceType } from '@termitary/engine';
import type { CanvasTheme } from './theme.js';

/** Whether one tone serves both players, each tile tone gets its own, or the palette is dropped. */
export type PieceHue = 'shared' | 'per-tile' | 'mono';

export const PIECE_HUES: readonly PieceHue[] = ['shared', 'per-tile', 'mono'];

export const isPieceHue = (value: unknown): value is PieceHue =>
  PIECE_HUES.includes(value as PieceHue);

const LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  ant: 'A',
  beetle: 'B',
  spider: 'S',
  grasshopper: 'G',
  ladybug: 'L',
  mosquito: 'M',
  pillbug: 'P',
};

// One hue per piece type, in the saturated mid register the physical tiles use,
// which is what lets a single tone sit on both an ivory tile and a black one.
// The deep tone is for 'per-tile', where the ivory side can afford a darker ink.
// The mosquito is the exception: a near-neutral, because the six hues had spent
// every part of the wheel that stays clear of its neighbours under dichromacy.
// The pillbug's teal is the wheel overdrawn rather than spent: under deuteranopia
// it sits close to the ant's blue, and the letter is what tells them apart. See #96.
const PIECE_INK: Record<PieceType, { readonly light: string; readonly dark: string }> = {
  queen: { light: '#e8b41e', dark: '#8f6e05' },
  ant: { light: '#5aa7cf', dark: '#1d5f80' },
  beetle: { light: '#8b7fd0', dark: '#4a3392' },
  spider: { light: '#a46a3f', dark: '#5e3a1d' },
  grasshopper: { light: '#57b24b', dark: '#2f6b1f' },
  ladybug: { light: '#d9534a', dark: '#8c2b23' },
  mosquito: { light: '#8a9299', dark: '#454b50' },
  pillbug: { light: '#3fa9a0', dark: '#1d6b65' },
};

export const pieceLetter = (type: PieceType): string => LETTERS[type];

/** The two tile tones, from a sampled theme on canvas or as `var()` in the DOM. */
export type TileTones = Pick<CanvasTheme, 'pieceWhiteFill' | 'pieceBlackFill'>;

export const CSS_TILE_TONES: TileTones = {
  pieceWhiteFill: 'var(--piece-white-fill)',
  pieceBlackFill: 'var(--piece-black-fill)',
};

export const pieceFill = (piece: Piece, theme: CanvasTheme): string =>
  piece.color === 'white' ? theme.pieceWhiteFill : theme.pieceBlackFill;

// 'shared' keeps one tone per piece across both players, so a piece is the same
// colour wherever it appears. 'per-tile' trades that for contrast: the deep tone
// on white's near-white tile, the light one on black's.
// 'mono' drops the palette for the other player's tile tone, so the whole board
// is the two tones the tiles already are.
export const pieceInk = (
  type: PieceType,
  color: Color,
  hue: PieceHue,
  tones: TileTones,
): string => {
  if (hue === 'mono') {
    return color === 'white' ? tones.pieceBlackFill : tones.pieceWhiteFill;
  }
  return PIECE_INK[type][hue === 'shared' || color === 'black' ? 'light' : 'dark'];
};

// The landing ghost is drawn on the board ground rather than on a tile, which is
// always the dark end.
export const pieceGhostInk = (type: PieceType, hue: PieceHue, tones: TileTones): string =>
  hue === 'mono' ? tones.pieceWhiteFill : PIECE_INK[type].light;
