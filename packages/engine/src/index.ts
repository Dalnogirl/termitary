export { type HexCoord, key, neighbors, parse, sharedNeighbors } from './hex.js';
export { canSlide, isConnectedWithout } from './occupancy.js';
export { type MovementFn, movements } from './movements/index.js';
export { getValidMoves } from './validator.js';
export { type GameResult, getResult, isQueenSurrounded } from './result.js';
export { getValidPlacementCoords } from './placement.js';
export type { Color, Piece, PieceType } from './piece.js';
export {
  type Board,
  empty,
  fromCells,
  isEmpty,
  occupiedCells,
  place,
  remove,
  stackAt,
  topPieceAt,
} from './board.js';
