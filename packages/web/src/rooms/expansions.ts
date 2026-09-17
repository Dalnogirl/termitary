import {
  BASE_RULESET,
  LADYBUG_RULESET,
  MOSQUITO_RULESET,
  PILLBUG_RULESET,
  type PieceType,
  type Ruleset,
} from '@termitary/engine';
import type { WireRuleset } from '@termitary/protocol';

// Each entry is base plus one piece, so merging the picked rulesets' pieces
// over base deals exactly the chosen set, at the counts the engine names.
export const EXPANSIONS = [
  {
    piece: 'ladybug',
    ruleset: LADYBUG_RULESET,
    label: 'Ladybug',
    note: 'Two steps on top of the hive, then one down.',
  },
  {
    piece: 'mosquito',
    ruleset: MOSQUITO_RULESET,
    label: 'Mosquito',
    note: 'Moves as whichever piece it touches.',
  },
  {
    piece: 'pillbug',
    ruleset: PILLBUG_RULESET,
    label: 'Pillbug',
    note: 'Moves one space, or lifts a neighbour over itself to one.',
  },
] as const satisfies readonly {
  readonly piece: PieceType;
  readonly ruleset: { readonly pieces: Readonly<Partial<Record<PieceType, number>>> };
  readonly label: string;
  readonly note: string;
}[];

export type ExpansionPiece = (typeof EXPANSIONS)[number]['piece'];

export const isExpansionPiece = (value: string): value is ExpansionPiece =>
  EXPANSIONS.some((expansion) => expansion.piece === value);

// The engine's Ruleset, not the wire's: the wire takes one as-is, and the
// hot-seat board needs one the engine will accept.
export const rulesetFor = (picked: readonly ExpansionPiece[]): Ruleset => {
  const pieces: Partial<Record<PieceType, number>> = { ...BASE_RULESET.pieces };
  for (const expansion of EXPANSIONS) {
    if (picked.includes(expansion.piece)) Object.assign(pieces, expansion.ruleset.pieces);
  }
  return { pieces };
};

/** Empty for a base game, which is why a base room shows no badge. */
export const expansionsIn = (ruleset: WireRuleset): readonly (typeof EXPANSIONS)[number][] =>
  EXPANSIONS.filter((expansion) => expansion.piece in ruleset.pieces);
