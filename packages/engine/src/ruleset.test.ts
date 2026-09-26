import { describe, expect, it } from 'vitest';
import { applyMove, createGame, listValidMoves } from './coordinator.js';
import {
  BASE_RULESET,
  EXPANSION_PIECES,
  IllegalRulesetError,
  LADYBUG_RULESET,
  MOSQUITO_RULESET,
  type Ruleset,
  isExpansionPiece,
  rulesetFor,
} from './ruleset.js';

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

describe('the ladybug expansion', () => {
  it('is one piece on top of the base set, and not in the base set itself', () => {
    expect(BASE_RULESET.pieces.ladybug).toBeUndefined();
    expect(createGame(LADYBUG_RULESET).hands.white).toEqual({
      queen: 1,
      ant: 3,
      beetle: 2,
      spider: 2,
      grasshopper: 3,
      ladybug: 1,
    });
  });

  it('offers the ladybug as an opening placement', () => {
    const opening = listValidMoves(createGame(LADYBUG_RULESET));
    expect(opening.some((m) => m.kind === 'place' && m.piece.type === 'ladybug')).toBe(true);
  });
});

describe('the mosquito expansion', () => {
  it('is one piece on top of the base set, and not in the base set itself', () => {
    expect(BASE_RULESET.pieces.mosquito).toBeUndefined();
    expect(createGame(MOSQUITO_RULESET).hands.white).toEqual({
      queen: 1,
      ant: 3,
      beetle: 2,
      spider: 2,
      grasshopper: 3,
      mosquito: 1,
    });
  });

  it('offers the mosquito as an opening placement', () => {
    const opening = listValidMoves(createGame(MOSQUITO_RULESET));
    expect(opening.some((m) => m.kind === 'place' && m.piece.type === 'mosquito')).toBe(true);
  });
});

describe('rulesetFor', () => {
  it('is base when nothing is picked', () => {
    expect(rulesetFor([])).toEqual({ pieces: { ...BASE_RULESET.pieces } });
  });

  it('deals one of each picked piece alongside the base set', () => {
    expect(rulesetFor(['ladybug', 'mosquito'])).toEqual({
      pieces: { ...BASE_RULESET.pieces, ladybug: 1, mosquito: 1 },
    });
  });

  it('deals exactly one of a piece picked on its own', () => {
    for (const piece of EXPANSION_PIECES) {
      expect(rulesetFor([piece]).pieces[piece]).toBe(1);
    }
  });

  it('deals every expansion when all are picked', () => {
    expect(rulesetFor(EXPANSION_PIECES)).toEqual({
      pieces: { ...BASE_RULESET.pieces, ladybug: 1, mosquito: 1, pillbug: 1 },
    });
  });
});

describe('isExpansionPiece', () => {
  it('accepts every expansion and nothing else', () => {
    for (const piece of EXPANSION_PIECES) expect(isExpansionPiece(piece)).toBe(true);
    expect(isExpansionPiece('queen')).toBe(false);
    expect(isExpansionPiece('')).toBe(false);
  });
});
