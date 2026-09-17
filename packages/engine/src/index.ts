// The engine's public surface. Board mutators (`place`, `remove`) and the rule
// predicates behind them stay unexported: `applyMove` validating by membership
// in `listValidMoves` is only an invariant while nobody can build a board
// around it. Internal callers import the relative module directly.
export type { HexCoord } from './hex.js';
export type { Color, Piece, PieceType } from './piece.js';
export { type Board, occupiedCells, topPieceAt } from './board.js';
export {
  type EndReason,
  type GameState,
  type Hand,
  type Move,
  IllegalMoveError,
  applyMove,
  createGame,
  listValidMoves,
  resign,
} from './coordinator.js';
export {
  type Ruleset,
  BASE_RULESET,
  LADYBUG_RULESET,
  MOSQUITO_RULESET,
  PILLBUG_RULESET,
  IllegalRulesetError,
  rulesetPieceTypes,
} from './ruleset.js';
export { replayFrames } from './replay.js';
