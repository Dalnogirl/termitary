import type { Piece, PieceType } from '@hive/engine';

const LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  ant: 'A',
  beetle: 'B',
  spider: 'S',
  grasshopper: 'G',
};

export const pieceLetter = (type: PieceType): string => LETTERS[type];

export const pieceFill = (piece: Piece): string =>
  piece.color === 'white' ? '#f5e6c8' : '#3a3a3a';

export const pieceTextColor = (piece: Piece): string =>
  piece.color === 'white' ? '#1a1a1a' : '#f5e6c8';

export const pieceStroke = (piece: Piece): string =>
  piece.color === 'white' ? '#8b7355' : '#1a1a1a';
