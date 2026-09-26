import type { ExpansionChoice, SeekPreference } from '@termitary/protocol';
import { EXPANSIONS, type ExpansionPiece } from './expansions.js';

/** The wire's two choices plus the absent key, which is "either". */
export type TriState = ExpansionChoice | 'either';

export const choiceFor = (preference: SeekPreference, piece: ExpansionPiece): TriState =>
  preference[piece] ?? 'either';

export const withChoice = (
  preference: SeekPreference,
  piece: ExpansionPiece,
  choice: TriState,
): SeekPreference => {
  const { [piece]: _, ...rest } = preference;
  return choice === 'either' ? rest : { ...rest, [piece]: choice };
};

/** Each "either" doubles it: `{}` accepts all 8 rulesets, three opinions accept 1. */
export const acceptedRulesets = (preference: SeekPreference): number =>
  EXPANSIONS.reduce((count, { piece }) => (preference[piece] === undefined ? count * 2 : count), 1);

/** One badge per opinion. A seek with none has no badges, and pairs with anything. */
export const seekBadges = (preference: SeekPreference): readonly string[] =>
  EXPANSIONS.flatMap(({ piece, label }) => {
    const choice = preference[piece];
    if (choice === 'require') return [label];
    if (choice === 'exclude') return [`No ${label.toLowerCase()}`];
    return [];
  });
