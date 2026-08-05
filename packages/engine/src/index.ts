export { type HexCoord, key, neighbors, parse, sharedNeighbors } from './hex.js';
export { canSlide } from './occupancy.js';
export { type MovementFn, movements } from './movements/index.js';
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
