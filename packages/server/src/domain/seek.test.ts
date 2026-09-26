import { BASE_RULESET, EXPANSION_PIECES, type Ruleset, rulesetFor } from '@termitary/engine';
import { ANY_GAME, type SeekPreference } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import { compatible, pairedRuleset } from './seek.js';

// Three choices per expansion, so the whole space is 27 preferences and 729
// pairs. Small enough to assert over exhaustively rather than sample.
const ALL_PREFERENCES: readonly SeekPreference[] = (() => {
  let preferences: SeekPreference[] = [{}];
  for (const piece of EXPANSION_PIECES) {
    preferences = preferences.flatMap((base) => [
      base,
      { ...base, [piece]: 'require' },
      { ...base, [piece]: 'exclude' },
    ]);
  }
  return preferences;
})();

const eachPair = (assert: (a: SeekPreference, b: SeekPreference) => void) => {
  for (const a of ALL_PREFERENCES) for (const b of ALL_PREFERENCES) assert(a, b);
};

const plays = (ruleset: Ruleset, piece: string) => piece in ruleset.pieces;

describe('compatible', () => {
  it('is symmetric', () => {
    eachPair((a, b) => expect(compatible(a, b)).toBe(compatible(b, a)));
  });

  it('accepts every preference against itself', () => {
    for (const preference of ALL_PREFERENCES) {
      expect(compatible(preference, preference)).toBe(true);
    }
  });

  it('pairs the default seek with anything', () => {
    for (const preference of ALL_PREFERENCES) {
      expect(compatible(ANY_GAME, preference)).toBe(true);
    }
  });

  it('refuses exactly when one side requires what the other excludes', () => {
    eachPair((a, b) => {
      const conflicted = EXPANSION_PIECES.some(
        (piece) =>
          (a[piece] === 'require' && b[piece] === 'exclude') ||
          (b[piece] === 'require' && a[piece] === 'exclude'),
      );
      expect(compatible(a, b)).toBe(!conflicted);
    });
  });
});

describe('pairedRuleset', () => {
  it('gives both default seekers a base game', () => {
    expect(pairedRuleset(ANY_GAME, ANY_GAME)).toEqual(BASE_RULESET);
  });

  it('does not depend on which seek was older', () => {
    eachPair((a, b) => {
      if (compatible(a, b)) expect(pairedRuleset(a, b)).toEqual(pairedRuleset(b, a));
    });
  });

  // The whole reason no preference column is needed: the union satisfies both
  // sides on its own, so there is nothing left to break a tie over.
  it('satisfies both sides of every pair it can be asked about', () => {
    eachPair((a, b) => {
      if (!compatible(a, b)) return;
      const ruleset = pairedRuleset(a, b);
      for (const piece of EXPANSION_PIECES) {
        for (const side of [a, b]) {
          if (side[piece] === 'require') expect(plays(ruleset, piece)).toBe(true);
          if (side[piece] === 'exclude') expect(plays(ruleset, piece)).toBe(false);
        }
      }
    });
  });

  it('adds nothing neither side asked for', () => {
    eachPair((a, b) => {
      if (!compatible(a, b)) return;
      const ruleset = pairedRuleset(a, b);
      for (const piece of EXPANSION_PIECES) {
        const wanted = a[piece] === 'require' || b[piece] === 'require';
        expect(plays(ruleset, piece)).toBe(wanted);
      }
    });
  });

  it('gives a lone requirer the piece against a default seeker', () => {
    expect(pairedRuleset({ pillbug: 'require' }, ANY_GAME)).toEqual(rulesetFor(['pillbug']));
  });
});
