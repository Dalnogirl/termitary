import { remove } from '../board.js';
import { type HexCoord, key, parse } from '../hex.js';
import type { MovementFn } from './index.js';
import { slideStep } from './utils.js';

const SPIDER_STEPS = 3;

export const spiderMovement: MovementFn = (from, board) => {
  const transit = remove(board, from);
  const destinations = new Set<string>();
  const path = new Set<string>([key(from)]);

  const dfs = (pos: HexCoord, depth: number): void => {
    if (depth === SPIDER_STEPS) {
      destinations.add(key(pos));
      return;
    }
    for (const n of slideStep(transit, pos)) {
      const nk = key(n);
      if (path.has(nk)) continue;
      path.add(nk);
      dfs(n, depth + 1);
      path.delete(nk);
    }
  };

  dfs(from, 0);
  return [...destinations].map(parse);
};
