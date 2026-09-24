import { type Board, remove, stackAt, topPieceAt } from '../board.js';
import { type HexCoord, key, neighbors } from '../hex.js';
import type { PieceType } from '../piece.js';
import { antRoute } from './ant.js';
import { beetleRoute } from './beetle.js';
import { type RouteFn, movements } from './index.js';
import { pillbugRoute } from './pillbug.js';
import { queenRoute } from './queen.js';
import { spiderRoute } from './spider.js';

type Route = readonly HexCoord[] | null;

/**
 * Only the pieces whose route is a slide. The grasshopper and the ladybug are
 * absent rather than mapped to a null-returning function: a piece with nothing
 * to show should not have to say so.
 */
const ROUTES: Partial<Record<PieceType, RouteFn>> = {
  queen: queenRoute,
  ant: antRoute,
  spider: spiderRoute,
  beetle: beetleRoute,
  pillbug: pillbugRoute,
};

const routeOf = (type: PieceType, transit: Board, from: HexCoord, to: HexCoord): Route =>
  ROUTES[type]?.(transit, from, to) ?? null;

const copiedTypes = (board: Board, from: HexCoord): PieceType[] => {
  const types = new Set<PieceType>();
  for (const n of neighbors(from)) {
    const top = topPieceAt(board, n);
    if (top && top.type !== 'mosquito') types.add(top.type);
  }
  return [...types];
};

const sameRoute = (a: Route, b: Route): boolean =>
  a !== null && b !== null && a.length === b.length && a.every((c, i) => key(c) === key(b[i] ?? c));

/**
 * A mosquito beside an ant and a grasshopper that both reach `to` could have
 * travelled either way, so it gets no route. Two copied types that reach `to`
 * by the same cells are not a disagreement, which is why routes are compared
 * rather than counted.
 */
const mosquitoRoute = (board: Board, transit: Board, from: HexCoord, to: HexCoord): Route => {
  const toKey = key(to);
  let agreed: Route = null;
  let distinct = 0;
  for (const type of copiedTypes(board, from)) {
    if (!movements[type](from, board).some((c) => key(c) === toKey)) continue;
    const route = routeOf(type, transit, from, to);
    if (sameRoute(agreed, route)) continue;
    distinct++;
    agreed = route;
  }
  return distinct === 1 ? agreed : null;
};

/**
 * The cells a piece passes through moving from `from` to `to` under its own
 * power, origin first and destination last, or `null` when it does not slide
 * there: a grasshopper, a climbing or descending beetle, a ladybug crossing the
 * roof, or a mosquito whose route is ambiguous.
 *
 * Movement geometry only. One-hive, the unplaced queen and the pillbug's stun
 * live in the coordinator, so a route here is not a claim that the move is
 * legal; ask `listValidMoves` for that.
 *
 * A pillbug throw moves a piece that is not the one deciding, so the caller
 * must not ask about the thrown piece; the board alone cannot tell.
 */
export const slidePath = (from: HexCoord, to: HexCoord, board: Board): Route => {
  const piece = topPieceAt(board, from);
  if (!piece) return null;
  if (stackAt(board, from).length > 1) return null;
  if (stackAt(board, to).length > 0) return null;
  const transit = remove(board, from);
  if (piece.type === 'mosquito') return mosquitoRoute(board, transit, from, to);
  return routeOf(piece.type, transit, from, to);
};
