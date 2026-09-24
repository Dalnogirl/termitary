import { type Board, remove } from '../board.js';
import { type HexCoord, key, parse } from '../hex.js';
import type { MovementFn, RouteFn } from './index.js';
import { slideStep } from './utils.js';

const SPIDER_STEPS = 3;

/**
 * Every three-step walk from `from`, origin first, handed to `arrive` whole.
 * Returning true from `arrive` abandons the search. Both the destinations and
 * the route a piece takes to one come out of this, so neither can claim a walk
 * the other does not allow.
 */
const walkThree = (
  transit: Board,
  from: HexCoord,
  arrive: (walk: readonly HexCoord[]) => boolean,
): void => {
  const walked = new Set<string>([key(from)]);

  const step = (pos: HexCoord, trail: readonly HexCoord[]): boolean => {
    if (trail.length === SPIDER_STEPS + 1) return arrive(trail);
    for (const n of slideStep(transit, pos)) {
      const nk = key(n);
      if (walked.has(nk)) continue;
      walked.add(nk);
      const stop = step(n, [...trail, n]);
      walked.delete(nk);
      if (stop) return true;
    }
    return false;
  };

  step(from, [from]);
};

const endOf = (walk: readonly HexCoord[]): HexCoord | undefined => walk[walk.length - 1];

export const spiderMovement: MovementFn = (from, board) => {
  const destinations = new Set<string>();
  walkThree(remove(board, from), from, (walk) => {
    const end = endOf(walk);
    if (end) destinations.add(key(end));
    return false;
  });
  return [...destinations].map(parse);
};

/**
 * The spider's own three steps, not the shortest way there. A cell three steps
 * out can be fewer steps away, and drawing that shorter way would show a move
 * the rules forbid.
 */
export const spiderRoute: RouteFn = (transit, from, to) => {
  const found: (readonly HexCoord[])[] = [];
  walkThree(transit, from, (walk) => {
    const end = endOf(walk);
    if (!end || key(end) !== key(to)) return false;
    found.push(walk);
    return true;
  });
  return found[0] ?? null;
};
