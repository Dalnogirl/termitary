import type { Board } from '../board.js';
import type { HexCoord } from '../hex.js';
import type { PieceType } from '../piece.js';
import { antMovement } from './ant.js';
import { beetleMovement } from './beetle.js';
import { grasshopperMovement } from './grasshopper.js';
import { ladybugMovement } from './ladybug.js';
import { mosquitoMovement } from './mosquito.js';
import { queenMovement } from './queen.js';
import { spiderMovement } from './spider.js';

export type MovementFn = (from: HexCoord, board: Board) => HexCoord[];

export const movements = {
  queen: queenMovement,
  ant: antMovement,
  grasshopper: grasshopperMovement,
  spider: spiderMovement,
  beetle: beetleMovement,
  ladybug: ladybugMovement,
  mosquito: mosquitoMovement,
} satisfies Record<PieceType, MovementFn>;
