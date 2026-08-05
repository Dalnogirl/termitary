import type { Board, GameState, Hand, Move } from '@hive/engine';
import { z } from 'zod';

const WireColorSchema = z.enum(['white', 'black']);
const WirePieceTypeSchema = z.enum(['queen', 'ant', 'beetle', 'spider', 'grasshopper']);

export const WireHexCoordSchema = z.object({ q: z.number().int(), r: z.number().int() }).strict();
export type WireHexCoord = z.infer<typeof WireHexCoordSchema>;

export const WirePieceSchema = z
  .object({ type: WirePieceTypeSchema, color: WireColorSchema })
  .strict();
export type WirePiece = z.infer<typeof WirePieceSchema>;

export const WireBoardSchema = z.record(z.string(), z.array(WirePieceSchema));
export type WireBoard = z.infer<typeof WireBoardSchema>;

const WireHandSchema = z
  .object({
    queen: z.number().int().min(0),
    ant: z.number().int().min(0),
    beetle: z.number().int().min(0),
    spider: z.number().int().min(0),
    grasshopper: z.number().int().min(0),
  })
  .strict();

const WireHandsSchema = z.object({ white: WireHandSchema, black: WireHandSchema }).strict();

const WireTurnNumbersSchema = z
  .object({
    white: z.number().int().min(0),
    black: z.number().int().min(0),
  })
  .strict();

export const WireMoveSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('place'),
      piece: WirePieceSchema,
      to: WireHexCoordSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('relocate'),
      from: WireHexCoordSchema,
      to: WireHexCoordSchema,
    })
    .strict(),
  z.object({ kind: z.literal('pass') }).strict(),
]);
export type WireMove = z.infer<typeof WireMoveSchema>;

const WireFinishedResultSchema = z.enum(['white-wins', 'black-wins', 'draw']);

const inProgressShape = {
  status: z.literal('in_progress'),
  board: WireBoardSchema,
  hands: WireHandsSchema,
  currentPlayer: WireColorSchema,
  turnNumbers: WireTurnNumbersSchema,
  history: z.array(WireMoveSchema),
} as const;

const finishedShape = {
  status: z.literal('finished'),
  result: WireFinishedResultSchema,
  board: WireBoardSchema,
  hands: WireHandsSchema,
  currentPlayer: WireColorSchema,
  turnNumbers: WireTurnNumbersSchema,
  history: z.array(WireMoveSchema),
} as const;

export const WireGameStateSchema = z.discriminatedUnion('status', [
  z.object(inProgressShape).strict(),
  z.object(finishedShape).strict(),
]);
export type WireGameState = z.infer<typeof WireGameStateSchema>;

const boardToWire = (board: Board): WireBoard => {
  const out: WireBoard = {};
  for (const [k, stack] of board.cells) out[k] = [...stack];
  return out;
};

const boardFromWire = (wire: WireBoard): Board => {
  const cells = new Map<string, readonly WirePiece[]>();
  for (const [k, stack] of Object.entries(wire)) {
    if (stack.length > 0) cells.set(k, stack);
  }
  return { cells };
};

export const toWireMove = (move: Move): WireMove => move;
export const fromWireMove = (wire: WireMove): Move => wire;

const toWireHand = (h: Hand): z.infer<typeof WireHandSchema> => ({ ...h });

export const toWire = (state: GameState): WireGameState => {
  const common = {
    board: boardToWire(state.board),
    hands: {
      white: toWireHand(state.hands.white),
      black: toWireHand(state.hands.black),
    },
    currentPlayer: state.currentPlayer,
    turnNumbers: { ...state.turnNumbers },
    history: state.history.map(toWireMove),
  };
  if (state.status === 'finished') {
    return { status: 'finished', result: state.result, ...common };
  }
  return { status: 'in_progress', ...common };
};

export const fromWire = (wire: WireGameState): GameState => {
  const common = {
    board: boardFromWire(wire.board),
    hands: {
      white: { ...wire.hands.white },
      black: { ...wire.hands.black },
    },
    currentPlayer: wire.currentPlayer,
    turnNumbers: { ...wire.turnNumbers },
    history: wire.history.map(fromWireMove),
  };
  if (wire.status === 'finished') {
    return { status: 'finished', result: wire.result, ...common };
  }
  return { status: 'in_progress', ...common };
};
