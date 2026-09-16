import { BASE_RULESET } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { expansionsIn, rulesetFor } from './expansions.js';

describe('rulesetFor', () => {
  it('is base when nothing is picked', () => {
    expect(rulesetFor([])).toEqual({ pieces: { ...BASE_RULESET.pieces } });
  });

  it('deals one of each picked piece alongside the base set', () => {
    expect(rulesetFor(['ladybug', 'mosquito'])).toEqual({
      pieces: { ...BASE_RULESET.pieces, ladybug: 1, mosquito: 1 },
    });
  });
});

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
