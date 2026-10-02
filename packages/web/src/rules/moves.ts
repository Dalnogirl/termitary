import type { Color, Move, PieceType } from '@termitary/engine';

export const place = (type: PieceType, color: Color, q: number, r: number): Move => ({
  kind: 'place',
  piece: { type, color },
  to: { q, r },
});

export const relocate = (from: [number, number], to: [number, number]): Move => ({
  kind: 'relocate',
  from: { q: from[0], r: from[1] },
  to: { q: to[0], r: to[1] },
});
