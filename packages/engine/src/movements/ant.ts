import { type Board, remove } from '../board.js';
import { type HexCoord, key, parse } from '../hex.js';
import type { MovementFn, RouteFn } from './index.js';
import { slideStep } from './utils.js';

type Crawl = {
  readonly cells: readonly HexCoord[];
  /** Each reached cell keyed to the one it was reached from. */
  readonly cameFrom: ReadonlyMap<string, string>;
};

/**
 * One breadth-first crawl, feeding both the destinations and the route to any
 * one of them. Keeping the predecessors is what separates the two, and it is
 * why they cannot disagree about where an ant may go.
 */
const crawl = (transit: Board, from: HexCoord): Crawl => {
  const cells: HexCoord[] = [];
  const cameFrom = new Map<string, string>();
  const visited = new Set<string>([key(from)]);
  const queue: HexCoord[] = [from];
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: loop guard ensures non-empty.
    const cur = queue.shift()!;
    const curKey = key(cur);
    for (const n of slideStep(transit, cur)) {
      const nk = key(n);
      if (visited.has(nk)) continue;
      visited.add(nk);
      cameFrom.set(nk, curKey);
      cells.push(n);
      queue.push(n);
    }
  }
  return { cells, cameFrom };
};

export const antMovement: MovementFn = (from, board) => [...crawl(remove(board, from), from).cells];

export const antRoute: RouteFn = (transit, from, to) => {
  const { cameFrom } = crawl(transit, from);
  const fromKey = key(from);
  const toKey = key(to);
  if (!cameFrom.has(toKey)) return null;
  const route = [toKey];
  let cur = toKey;
  while (cur !== fromKey) {
    const before = cameFrom.get(cur);
    if (before === undefined) return null;
    route.push(before);
    cur = before;
  }
  return route.reverse().map(parse);
};
