// The engine's public surface. Board mutators (`place`, `remove`) and the rule
// predicates behind them stay unexported: `applyMove` validating by membership
// in `listValidMoves` is only an invariant while nobody can build a board
// around it. Internal callers import the relative module directly.
export type { HexCoord } from './hex.js';
export type { Color, Piece, PieceType } from './piece.js';
export { type Board, occupiedCells, topPieceAt } from './board.js';
export {
  type GameState,
  type Hand,
  type Move,
  IllegalMoveError,
  applyMove,
  createGame,
  listValidMoves,
} from './coordinator.js';
