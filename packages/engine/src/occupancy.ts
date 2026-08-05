import type { Board } from './board.js';
import { isEmpty } from './board.js';
import { type HexCoord, key, neighbors, parse, sharedNeighbors } from './hex.js';

export const canSlide = (board: Board, from: HexCoord, to: HexCoord): boolean => {
  const gates = sharedNeighbors(from, to);
  const hasGap = gates.some((g) => isEmpty(board, g));
  const hasAnchor = gates.some((g) => !isEmpty(board, g));
  return hasGap && hasAnchor;
};

export const isConnectedWithout = (board: Board, c: HexCoord): boolean => {
  const excluded = key(c);
  const stack = board.cells.get(excluded);
  // Stack > 1: removing the top piece leaves the cell still occupied.
  if ((stack?.length ?? 0) > 1) return true;

  const remaining = new Set([...board.cells.keys()].filter((k) => k !== excluded));
  if (remaining.size <= 1) return true;

  const [startKey] = remaining;
  // biome-ignore lint/style/noNonNullAssertion: guarded by remaining.size > 1 above.
  const visited = new Set([startKey!]);
  // biome-ignore lint/style/noNonNullAssertion: same guard.
  const queue: HexCoord[] = [parse(startKey!)];
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: loop condition guarantees non-empty.
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const nk = key(n);
      if (remaining.has(nk) && !visited.has(nk)) {
        visited.add(nk);
        queue.push(n);
      }
    }
  }
  return visited.size === remaining.size;
};
