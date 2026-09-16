import type { PieceType } from './piece.js';

export type Ruleset = {
  readonly pieces: Readonly<Partial<Record<PieceType, number>>>;
};

export const BASE_RULESET: Ruleset = {
  pieces: { queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
};

export class IllegalRulesetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalRulesetError';
  }
}

export const assertLegalRuleset = (ruleset: Ruleset): void => {
  if (ruleset.pieces.queen !== 1) {
    throw new IllegalRulesetError('A ruleset needs exactly one queen');
  }
  for (const [type, count] of Object.entries(ruleset.pieces)) {
    if (!Number.isInteger(count) || count < 1) {
      throw new IllegalRulesetError(`Count for ${type} must be a positive integer, got ${count}`);
    }
  }
};

// The only place the engine trades PieceType's exhaustiveness for Object.keys.
export const rulesetPieceTypes = (ruleset: Ruleset): readonly PieceType[] =>
  Object.keys(ruleset.pieces) as PieceType[];
