import {
  BASE_RULESET,
  type Board,
  type Color,
  type GameState,
  type Move,
  type PieceType,
  type Ruleset,
} from '@termitary/engine';
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

const pieceCounts = (min: number) =>
  z
    .object({
      queen: z.number().int().min(min),
      ant: z.number().int().min(min),
      beetle: z.number().int().min(min),
      spider: z.number().int().min(min),
      grasshopper: z.number().int().min(min),
    })
    .partial()
    .strict();

// A hand keeps a key at zero once its pieces are all placed, so absent means
// the ruleset never included the type, not that the player ran out.
const WireHandSchema = pieceCounts(0);
type WireHand = z.infer<typeof WireHandSchema>;

const WireHandsSchema = z.object({ white: WireHandSchema, black: WireHandSchema }).strict();

// Counts start at 1: a piece the ruleset does not include has no key at all,
// so a zero would be a second way to say absent.
export const WireRulesetSchema = z.object({ pieces: pieceCounts(1) }).strict();
export type WireRuleset = z.infer<typeof WireRulesetSchema>;

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
const WireEndReasonSchema = z.enum(['queen-surrounded', 'resignation']);

const inProgressShape = {
  status: z.literal('in_progress'),
  // Optional rather than defaulted: a state stored before the wire carried a
  // ruleset has none, and `fromWire` reads that absence as base.
  ruleset: WireRulesetSchema.optional(),
  board: WireBoardSchema,
  hands: WireHandsSchema,
  currentPlayer: WireColorSchema,
  turnNumbers: WireTurnNumbersSchema,
  history: z.array(WireMoveSchema),
} as const;

const finishedShape = {
  status: z.literal('finished'),
  ruleset: WireRulesetSchema.optional(),
  result: WireFinishedResultSchema,
  endReason: WireEndReasonSchema,
  board: WireBoardSchema,
  hands: WireHandsSchema,
  currentPlayer: WireColorSchema,
  turnNumbers: WireTurnNumbersSchema,
  history: z.array(WireMoveSchema),
} as const;

// A hand holding a type the ruleset never dealt would be a piece nobody can
// account for, and the engine would happily let it be placed.
const handsFitRuleset = (
  wire: { readonly ruleset?: WireRuleset | undefined; readonly hands: Record<Color, WireHand> },
  ctx: z.RefinementCtx,
): void => {
  const dealt = new Set(Object.keys(wire.ruleset?.pieces ?? BASE_RULESET.pieces));
  for (const color of ['white', 'black'] as const) {
    for (const type of Object.keys(wire.hands[color])) {
      if (dealt.has(type)) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hands', color, type],
        message: `${color} holds a ${type}, which this ruleset does not include`,
      });
    }
  }
};

export const WireGameStateSchema = z
  .discriminatedUnion('status', [
    z.object(inProgressShape).strict(),
    z.object(finishedShape).strict(),
  ])
  .superRefine(handsFitRuleset);
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

// zod's `.partial()` gives every key an explicit `| undefined`, which
// `exactOptionalPropertyTypes` will not assign to an optional property.
const definedCounts = (
  counts: Readonly<Partial<Record<PieceType, number | undefined>>>,
): Partial<Record<PieceType, number>> =>
  Object.fromEntries(Object.entries(counts).filter(([, count]) => count !== undefined));

export const toWireRuleset = (ruleset: Ruleset): WireRuleset => ({ pieces: { ...ruleset.pieces } });

export const fromWireRuleset = (wire: WireRuleset): Ruleset => ({
  pieces: definedCounts(wire.pieces),
});

export const toWireMove = (move: Move): WireMove => move;
export const fromWireMove = (wire: WireMove): Move => wire;

export const toWire = (state: GameState): WireGameState => {
  const common = {
    ruleset: toWireRuleset(state.ruleset),
    board: boardToWire(state.board),
    hands: {
      white: { ...state.hands.white },
      black: { ...state.hands.black },
    },
    currentPlayer: state.currentPlayer,
    turnNumbers: { ...state.turnNumbers },
    history: state.history.map(toWireMove),
  };
  if (state.status === 'finished') {
    return { status: 'finished', result: state.result, endReason: state.endReason, ...common };
  }
  return { status: 'in_progress', ...common };
};

// `ruleset` overrides whatever the state carries, for the one caller that has a
// better source: a room stores its ruleset in its own column, and a row written
// before the state carried one has it nowhere else.
export const fromWire = (wire: WireGameState, ruleset?: Ruleset): GameState => {
  const common = {
    ruleset: ruleset ?? (wire.ruleset === undefined ? BASE_RULESET : fromWireRuleset(wire.ruleset)),
    board: boardFromWire(wire.board),
    hands: {
      white: definedCounts(wire.hands.white),
      black: definedCounts(wire.hands.black),
    },
    currentPlayer: wire.currentPlayer,
    turnNumbers: { ...wire.turnNumbers },
    history: wire.history.map(fromWireMove),
  };
  if (wire.status === 'finished') {
    return { status: 'finished', result: wire.result, endReason: wire.endReason, ...common };
  }
  return { status: 'in_progress', ...common };
};
