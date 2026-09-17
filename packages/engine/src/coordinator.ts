import { type Board, empty, occupiedCells, place, remove, topPieceAt } from './board.js';
import type { HexCoord } from './hex.js';
import { pillbugThrows } from './movements/pillbug.js';
import type { Color, Piece, PieceType } from './piece.js';
import { getValidPlacementCoords } from './placement.js';
import { type GameResult, getResult } from './result.js';
import { BASE_RULESET, type Ruleset, assertLegalRuleset, rulesetPieceTypes } from './ruleset.js';
import { stunnedCell } from './stun.js';
import { getValidMoves as getPieceValidMoves } from './validator.js';

export type Hand = Partial<Record<PieceType, number>>;

export type Move =
  | { readonly kind: 'place'; readonly piece: Piece; readonly to: HexCoord }
  | { readonly kind: 'relocate'; readonly from: HexCoord; readonly to: HexCoord }
  // `by` is the pillbug doing the throwing. The board would come out the same
  // without it, but two pillbugs can offer the same throw and the mover is the
  // half a player picked first.
  | {
      readonly kind: 'throw';
      readonly by: HexCoord;
      readonly from: HexCoord;
      readonly to: HexCoord;
    }
  | { readonly kind: 'pass' };

type FinishedResult = Exclude<GameResult, 'ongoing'>;

export type EndReason = 'queen-surrounded' | 'resignation';

export type GameState =
  | {
      readonly status: 'in_progress';
      readonly ruleset: Ruleset;
      readonly board: Board;
      readonly hands: Record<Color, Hand>;
      readonly currentPlayer: Color;
      readonly turnNumbers: Record<Color, number>;
      readonly history: readonly Move[];
    }
  | {
      readonly status: 'finished';
      readonly ruleset: Ruleset;
      readonly result: FinishedResult;
      readonly endReason: EndReason;
      readonly board: Board;
      readonly hands: Record<Color, Hand>;
      readonly currentPlayer: Color;
      readonly turnNumbers: Record<Color, number>;
      readonly history: readonly Move[];
    };

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

const handFrom = (ruleset: Ruleset): Hand => ({ ...ruleset.pieces });

const cloneHand = (h: Hand): Hand => ({ ...h });

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;
const samePiece = (a: Piece, b: Piece): boolean => a.type === b.type && a.color === b.color;
const sameMove = (a: Move, b: Move): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'pass' && b.kind === 'pass') return true;
  if (a.kind === 'place' && b.kind === 'place') {
    return samePiece(a.piece, b.piece) && sameCoord(a.to, b.to);
  }
  if (a.kind === 'relocate' && b.kind === 'relocate') {
    return sameCoord(a.from, b.from) && sameCoord(a.to, b.to);
  }
  if (a.kind === 'throw' && b.kind === 'throw') {
    return sameCoord(a.by, b.by) && sameCoord(a.from, b.from) && sameCoord(a.to, b.to);
  }
  return false;
};

export const createGame = (ruleset: Ruleset = BASE_RULESET): GameState => {
  assertLegalRuleset(ruleset);
  return {
    status: 'in_progress',
    ruleset,
    board: empty(),
    hands: { white: handFrom(ruleset), black: handFrom(ruleset) },
    currentPlayer: 'white',
    turnNumbers: { white: 0, black: 0 },
    history: [],
  };
};

export const listValidMoves = (state: GameState): Move[] => {
  if (state.status === 'finished') return [];

  const { board, hands, currentPlayer, turnNumbers, ruleset } = state;
  const hand = hands[currentPlayer];
  const turn = turnNumbers[currentPlayer];
  const queenInHand = (hand.queen ?? 0) > 0;
  // Queen must be placed by the player's 4th turn (turnNumbers is 0-indexed
  // completed turns, so the 4th turn is when turn === 3).
  const mustPlaceQueen = turn === 3 && queenInHand;

  const placementCoords = getValidPlacementCoords(board, currentPlayer, turn);
  const placements: Move[] = [];
  for (const type of rulesetPieceTypes(ruleset)) {
    if (mustPlaceQueen && type !== 'queen') continue;
    if ((hand[type] ?? 0) <= 0) continue;
    for (const to of placementCoords) {
      placements.push({ kind: 'place', piece: { type, color: currentPlayer }, to });
    }
  }

  const relocations: Move[] = [];
  const throws: Move[] = [];
  // Moving anything, the pillbug's ability included, waits on the active
  // player's queen reaching the board.
  if (!queenInHand) {
    const stunned = stunnedCell(state.history);
    const isStunned = (c: HexCoord): boolean => stunned !== undefined && sameCoord(c, stunned);

    for (const [from] of occupiedCells(board)) {
      const top = topPieceAt(board, from);
      if (!top || top.color !== currentPlayer || isStunned(from)) continue;

      for (const to of getPieceValidMoves(top, from, board)) {
        relocations.push({ kind: 'relocate', from, to });
      }

      if (top.type !== 'pillbug') continue;
      for (const { from: thrown, to } of pillbugThrows(from, board)) {
        if (isStunned(thrown)) continue;
        throws.push({ kind: 'throw', by: from, from: thrown, to });
      }
    }
  }

  const all = [...placements, ...relocations, ...throws];
  if (all.length === 0) return [{ kind: 'pass' }];
  return all;
};

export const applyMove = (state: GameState, move: Move): GameState => {
  if (state.status === 'finished') {
    throw new IllegalMoveError('Game is already finished');
  }

  const valid = listValidMoves(state);
  if (!valid.some((m) => sameMove(m, move))) {
    throw new IllegalMoveError(`Illegal move for ${state.currentPlayer}`);
  }

  let newBoard: Board = state.board;
  const newHand: Hand = cloneHand(state.hands[state.currentPlayer]);

  switch (move.kind) {
    case 'place': {
      newBoard = place(newBoard, move.to, move.piece);
      newHand[move.piece.type] = (newHand[move.piece.type] ?? 0) - 1;
      break;
    }
    case 'relocate':
    case 'throw': {
      const piece = topPieceAt(state.board, move.from);
      if (!piece) {
        // Defense-in-depth: listValidMoves should never emit a move with no
        // piece at `from`.
        throw new IllegalMoveError('No piece to move');
      }
      newBoard = place(remove(state.board, move.from), move.to, piece);
      break;
    }
    case 'pass':
      break;
  }

  const newHistory: readonly Move[] = [...state.history, move];
  const newTurnNumbers: Record<Color, number> = {
    ...state.turnNumbers,
    [state.currentPlayer]: state.turnNumbers[state.currentPlayer] + 1,
  };
  const nextPlayer: Color = state.currentPlayer === 'white' ? 'black' : 'white';
  const newHands: Record<Color, Hand> = {
    ...state.hands,
    [state.currentPlayer]: newHand,
  };

  const result = getResult(newBoard);
  if (result !== 'ongoing') {
    return {
      status: 'finished',
      ruleset: state.ruleset,
      result,
      endReason: 'queen-surrounded',
      board: newBoard,
      hands: newHands,
      currentPlayer: nextPlayer,
      turnNumbers: newTurnNumbers,
      history: newHistory,
    };
  }

  return {
    status: 'in_progress',
    ruleset: state.ruleset,
    board: newBoard,
    hands: newHands,
    currentPlayer: nextPlayer,
    turnNumbers: newTurnNumbers,
    history: newHistory,
  };
};

export const resign = (state: GameState, color: Color): GameState => {
  if (state.status === 'finished') {
    throw new IllegalMoveError('Game is already finished');
  }
  return {
    status: 'finished',
    ruleset: state.ruleset,
    result: color === 'white' ? 'black-wins' : 'white-wins',
    endReason: 'resignation',
    board: state.board,
    hands: state.hands,
    currentPlayer: state.currentPlayer,
    turnNumbers: state.turnNumbers,
    history: state.history,
  };
};
