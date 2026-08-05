import type { Piece, PieceType } from '@hive/engine';
import type { CanvasTheme } from './theme.js';

const LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  ant: 'A',
  beetle: 'B',
  spider: 'S',
  grasshopper: 'G',
};

export const pieceLetter = (type: PieceType): string => LETTERS[type];

export const pieceFill = (piece: Piece, theme: CanvasTheme): string =>
  piece.color === 'white' ? theme.pieceWhiteFill : theme.pieceBlackFill;

export const pieceTextColor = (piece: Piece, theme: CanvasTheme): string =>
  piece.color === 'white' ? theme.pieceWhiteText : theme.pieceBlackText;
