import { BASE_RULESET, EXPANSION_PIECES, rulesetFor } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { EXPANSIONS, expansionsIn } from './expansions.js';

describe('expansionsIn', () => {
  it('finds nothing in a base game, so a base room gets no badge', () => {
    expect(expansionsIn({ pieces: { ...BASE_RULESET.pieces } })).toEqual([]);
  });

  it('names the pieces a room added, in a fixed order', () => {
    const picked = expansionsIn(rulesetFor(['mosquito', 'ladybug']));
    expect(picked.map((expansion) => expansion.label)).toEqual(['Ladybug', 'Mosquito']);
  });

  it('ignores a base piece the room dropped', () => {
    expect(expansionsIn({ pieces: { queen: 1, ant: 3 } })).toEqual([]);
  });
});

describe('EXPANSIONS', () => {
  // The picker renders this list, so a piece added to the engine and
  // forgotten here would be a ruleset nobody can select.
  it('carries copy for every expansion piece', () => {
    expect(EXPANSIONS.map((expansion) => expansion.piece)).toEqual([...EXPANSION_PIECES]);
  });
});
