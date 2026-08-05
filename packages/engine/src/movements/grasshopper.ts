import { isEmpty } from '../board.js';
import { type HexCoord, neighbors } from '../hex.js';
import type { MovementFn } from './index.js';

export const grasshopperMovement: MovementFn = (from, board) => {
  const targets: HexCoord[] = [];
  for (const first of neighbors(from)) {
    if (isEmpty(board, first)) continue; // must jump over at least one piece
    const dq = first.q - from.q;
    const dr = first.r - from.r;
    let pos: HexCoord = first;
    while (!isEmpty(board, pos)) {
      pos = { q: pos.q + dq, r: pos.r + dr };
    }
    targets.push(pos);
  }
  return targets;
};
