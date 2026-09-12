import { type Board, empty, occupiedCells, place, remove, topPieceAt } from './board.js';
import type { HexCoord } from './hex.js';
import type { Color, Piece, PieceType } from './piece.js';
import { getValidPlacementCoords } from './placement.js';
import { type GameResult, getResult } from './result.js';
import { getValidMoves as getPieceValidMoves } from './validator.js';

export type Hand = Record<PieceType, number>;

export type Move =
  | { readonly kind: 'place'; readonly piece: Piece; readonly to: HexCoord }
  | { readonly kind: 'relocate'; readonly from: HexCoord; readonly to: HexCoord }
  | { readonly kind: 'pass' };

type FinishedResult = Exclude<GameResult, 'ongoing'>;

export type EndReason = 'queen-surrounded' | 'resignation';

export type GameState =
  | {
      readonly status: 'in_progress';
      readonly board: Board;
      readonly hands: Record<Color, Hand>;
      readonly currentPlayer: Color;
      readonly turnNumbers: Record<Color, number>;
      readonly history: readonly Move[];
    }
  | {
      readonly status: 'finished';
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

const PIECE_TYPES: readonly PieceType[] = ['queen', 'ant', 'beetle', 'spider', 'grasshopper'];

const INITIAL_HAND: Hand = { queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 };

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
  return false;
};

export const createGame = (): GameState => ({
  status: 'in_progress',
  board: empty(),
  hands: { white: cloneHand(INITIAL_HAND), black: cloneHand(INITIAL_HAND) },
  currentPlayer: 'white',
  turnNumbers: { white: 0, black: 0 },
  history: [],
});

export const listValidMoves = (state: GameState): Move[] => {
  if (state.status === 'finished') return [];

  const { board, hands, currentPlayer, turnNumbers } = state;
  const hand = hands[currentPlayer];
  const turn = turnNumbers[currentPlayer];
  const queenInHand = hand.queen > 0;
  // Queen must be placed by the player's 4th turn (turnNumbers is 0-indexed
  // completed turns, so the 4th turn is when turn === 3).
  const mustPlaceQueen = turn === 3 && queenInHand;

  const placementCoords = getValidPlacementCoords(board, currentPlayer, turn);
  const placements: Move[] = [];
  for (const type of PIECE_TYPES) {
    if (mustPlaceQueen && type !== 'queen') continue;
    if (hand[type] <= 0) continue;
    for (const to of placementCoords) {
      placements.push({ kind: 'place', piece: { type, color: currentPlayer }, to });
    }
  }

  const relocations: Move[] = [];
  // Relocations are legal only once the active player's queen is on the board.
  if (!queenInHand) {
    for (const [from] of occupiedCells(board)) {
      const top = topPieceAt(board, from);
      if (!top || top.color !== currentPlayer) continue;
      for (const to of getPieceValidMoves(top, from, board)) {
        relocations.push({ kind: 'relocate', from, to });
      }
    }
  }

  const all = [...placements, ...relocations];
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
      newHand[move.piece.type] -= 1;
      break;
    }
    case 'relocate': {
      const piece = topPieceAt(state.board, move.from);
      if (!piece) {
        // Defense-in-depth: listValidMoves should never emit a relocate
        // with no piece at `from`.
        throw new IllegalMoveError('No piece to relocate');
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
    result: color === 'white' ? 'black-wins' : 'white-wins',
    endReason: 'resignation',
    board: state.board,
    hands: state.hands,
    currentPlayer: state.currentPlayer,
    turnNumbers: state.turnNumbers,
    history: state.history,
  };
};
