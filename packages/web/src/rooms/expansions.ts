import type { ExpansionPiece } from '@termitary/engine';
import type { WireRuleset } from '@termitary/protocol';

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
