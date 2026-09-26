import { type ExpansionPiece, isExpansionPiece, rulesetFor } from '@termitary/engine';
import type { WireRuleset } from '@termitary/protocol';

// The piece list and the ruleset it deals are the engine's: composing base
// plus an expansion is a rules question, and hot-seat asks it without a
// server. What stays here is the copy the picker renders.
export { type ExpansionPiece, isExpansionPiece, rulesetFor };

export const EXPANSIONS = [
  {
    piece: 'ladybug',
    label: 'Ladybug',
    note: 'Two steps on top of the hive, then one down.',
  },
  {
    piece: 'mosquito',
    label: 'Mosquito',
    note: 'Moves as whichever piece it touches.',
  },
  {
    piece: 'pillbug',
    label: 'Pillbug',
    note: 'Moves one space, or lifts a neighbour over itself to one.',
  },
] as const satisfies readonly {
  readonly piece: ExpansionPiece;
  readonly label: string;
  readonly note: string;
}[];

/** Empty for a base game, which is why a base room shows no badge. */
export const expansionsIn = (ruleset: WireRuleset): readonly (typeof EXPANSIONS)[number][] =>
  EXPANSIONS.filter((expansion) => expansion.piece in ruleset.pieces);
