import type { Piece, PieceType } from '@hive/engine';

const LETTERS: Record<PieceType, string> = {
  queen: 'Q',
  ant: 'A',
  beetle: 'B',
  spider: 'S',
  grasshopper: 'G',
};

const TYPE_ACCENT: Record<PieceType, string> = {
  queen: '#e6a800',
  ant: '#3b82f6',
  beetle: '#8b5cf6',
  spider: '#92400e',
  grasshopper: '#22c55e',
};

export const pieceLetter = (type: PieceType): string => LETTERS[type];

export const pieceTypeAccent = (type: PieceType): string => TYPE_ACCENT[type];

export const pieceFill = (piece: Piece): string =>
  piece.color === 'white' ? '#f5e6c8' : '#3a3a3a';

export const pieceTextColor = (piece: Piece): string =>
  piece.color === 'white' ? '#1a1a1a' : '#f5e6c8';
