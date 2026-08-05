import { remove } from '../board.js';
import { type HexCoord, key } from '../hex.js';
import type { MovementFn } from './index.js';
import { slideStep } from './utils.js';

export const antMovement: MovementFn = (from, board) => {
  const transit = remove(board, from);
  const visited = new Set<string>([key(from)]);
  const result: HexCoord[] = [];
  const queue: HexCoord[] = [from];
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: loop guard ensures non-empty.
    const cur = queue.shift()!;
    for (const n of slideStep(transit, cur)) {
      const nk = key(n);
      if (visited.has(nk)) continue;
      visited.add(nk);
      result.push(n);
      queue.push(n);
    }
  }
  return result;
};
