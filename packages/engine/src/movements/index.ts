import type { Board } from '../board.js';
import type { HexCoord } from '../hex.js';
import type { PieceType } from '../piece.js';
import { antMovement } from './ant.js';
import { beetleMovement } from './beetle.js';
import { grasshopperMovement } from './grasshopper.js';
import { ladybugMovement } from './ladybug.js';
import { mosquitoMovement } from './mosquito.js';
import { pillbugMovement } from './pillbug.js';
import { queenMovement } from './queen.js';
import { spiderMovement } from './spider.js';

export type MovementFn = (from: HexCoord, board: Board) => HexCoord[];

/**
 * The cells a piece of this type crosses going from `from` to `to`, origin
 * first and destination last, or null when it does not slide there. `transit`
 * is the board with the moving piece already lifted off, as movement sees it.
 *
 * A piece only has one where its route is the rule: an ant hugging the hive
 * teaches freedom of movement, a grasshopper's jump teaches nothing.
 */
export type RouteFn = (transit: Board, from: HexCoord, to: HexCoord) => readonly HexCoord[] | null;

export const movements = {
  queen: queenMovement,
  ant: antMovement,
  grasshopper: grasshopperMovement,
  spider: spiderMovement,
  beetle: beetleMovement,
  ladybug: ladybugMovement,
  mosquito: mosquitoMovement,
  pillbug: pillbugMovement,
} satisfies Record<PieceType, MovementFn>;
