import { type Board, occupiedCells, topPieceAt } from '../board.js';
import {
  type GameState,
  type Move,
  applyMove,
  createGame,
  listValidMoves,
} from '../coordinator.js';
import { type HexCoord, neighbors } from '../hex.js';
import type { Color } from '../piece.js';
import { BASE_RULESET, type Ruleset } from '../ruleset.js';

export type ScriptedGame = {
  readonly ruleset: Ruleset;
  readonly moves: readonly Move[];
  readonly final: Extract<GameState, { status: 'finished' }>;
};

const MOVE_LIMIT = 80;

const queenCell = (board: Board, color: Color): HexCoord | null => {
  for (const [coord, stack] of occupiedCells(board)) {
    if (stack.some((p) => p.type === 'queen' && p.color === color)) return coord;
  }
  return null;
};

const ringSize = (board: Board, color: Color): number => {
  const queen = queenCell(board, color);
  if (queen === null) return 0;
  return neighbors(queen).filter((n) => topPieceAt(board, n) !== undefined).length;
};

// Both sides pull towards the same end: black's queen boxed in, white's left
// with room, queens on the board early. Black playing into its own loss is what
// keeps the search one ply deep and the walk short.
const score = (state: GameState): number =>
  ringSize(state.board, 'black') * 4 -
  ringSize(state.board, 'white') * 3 +
  (queenCell(state.board, 'black') === null ? 0 : 2) +
  (queenCell(state.board, 'white') === null ? 0 : 1);

// `listValidMoves` orders by generation, so a tie would otherwise follow
// whatever order the board's Map happens to be in.
const byShape = (a: Move, b: Move): number => {
  const [left, right] = [JSON.stringify(a), JSON.stringify(b)];
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const play = (): ScriptedGame => {
  let state: GameState = createGame(BASE_RULESET);
  const moves: Move[] = [];

  while (state.status === 'in_progress' && moves.length < MOVE_LIMIT) {
    let best: { readonly move: Move; readonly next: GameState; readonly score: number } | null =
      null;
    for (const move of [...listValidMoves(state)].sort(byShape)) {
      const next = applyMove(state, move);
      const candidate = { move, next, score: score(next) };
      if (best === null || candidate.score > best.score) best = candidate;
    }
    if (best === null) throw new Error('scripted game reached a position with no legal move');
    moves.push(best.move);
    state = best.next;
  }

  if (state.status !== 'finished' || state.endReason !== 'queen-surrounded') {
    throw new Error(`scripted game did not reach a surround in ${MOVE_LIMIT} moves`);
  }
  return { ruleset: BASE_RULESET, moves, final: state };
};

/**
 * A base-ruleset game played to a surrounded black queen, derived from the
 * engine at import time rather than written down, so a rule change moves the
 * fixture instead of invalidating it. The wire and browser suites drive the
 * same list, which is why it lives here and not beside either driver.
 */
export const SURROUND_GAME: ScriptedGame = play();
