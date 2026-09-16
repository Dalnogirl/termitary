import { describe, expect, it } from 'vitest';
import { applyMove, createGame, listValidMoves } from './coordinator.js';
import { BASE_RULESET, IllegalRulesetError, type Ruleset } from './ruleset.js';

const without = (type: 'spider' | 'ant'): Ruleset => {
  const { [type]: _dropped, ...rest } = BASE_RULESET.pieces;
  return { pieces: rest };
};

describe('createGame with the base ruleset', () => {
  it('hands out what it handed out before rulesets existed', () => {
    const s = createGame();
    expect(s.hands.white).toEqual({ queen: 1, ant: 3, beetle: 2, spider: 2, grasshopper: 3 });
    expect(s.hands.black).toEqual(s.hands.white);
    expect(s.ruleset).toEqual(BASE_RULESET);
  });

  it('carries the ruleset into the state a move produces', () => {
    const ruleset = without('spider');
    const s = createGame(ruleset);
    const [move] = listValidMoves(s);
    if (!move) throw new Error('expected an opening move');
    expect(applyMove(s, move).ruleset).toBe(ruleset);
  });
});

describe('a ruleset that omits a type', () => {
  it('leaves the type out of the hand entirely rather than zeroing it', () => {
    const s = createGame(without('spider'));
    expect('spider' in s.hands.white).toBe(false);
    expect(s.hands.white.spider).toBeUndefined();
  });

  it('never offers a placement for it', () => {
    const s = createGame(without('spider'));
    const placed = listValidMoves(s).filter((m) => m.kind === 'place');
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.some((m) => m.piece.type === 'spider')).toBe(false);
  });
});

describe('createGame rejects a ruleset it cannot play', () => {
  it('throws without a queen, which would otherwise make the game unwinnable', () => {
    const { queen: _q, ...rest } = BASE_RULESET.pieces;
    expect(() => createGame({ pieces: rest })).toThrow(IllegalRulesetError);
  });

  it('throws on more than one queen', () => {
    expect(() => createGame({ pieces: { ...BASE_RULESET.pieces, queen: 2 } })).toThrow(
      IllegalRulesetError,
    );
  });

  it('throws on a zero count, since absence is how a type is left out', () => {
    expect(() => createGame({ pieces: { ...BASE_RULESET.pieces, ant: 0 } })).toThrow(
      IllegalRulesetError,
    );
  });

  it('throws on a negative or fractional count', () => {
    expect(() => createGame({ pieces: { ...BASE_RULESET.pieces, ant: -1 } })).toThrow(
      IllegalRulesetError,
    );
    expect(() => createGame({ pieces: { ...BASE_RULESET.pieces, beetle: 1.5 } })).toThrow(
      IllegalRulesetError,
    );
  });
});
