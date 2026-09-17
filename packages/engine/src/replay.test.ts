import { describe, expect, it } from 'vitest';
import {
  type GameState,
  IllegalMoveError,
  type Move,
  applyMove,
  createGame,
  listValidMoves,
} from './coordinator.js';
import type { HexCoord } from './hex.js';
import type { Piece } from './piece.js';
import { replayFrames } from './replay.js';
import { BASE_RULESET, PILLBUG_RULESET, type Ruleset } from './ruleset.js';

const WQ: Piece = { type: 'queen', color: 'white' };
const WA: Piece = { type: 'ant', color: 'white' };
const BQ: Piece = { type: 'queen', color: 'black' };
const BA: Piece = { type: 'ant', color: 'black' };

const ORIGIN: HexCoord = { q: 0, r: 0 };
const E: HexCoord = { q: 1, r: 0 };
const EE: HexCoord = { q: 2, r: 0 };
const W: HexCoord = { q: -1, r: 0 };

const SCRIPT: readonly Move[] = [
  { kind: 'place', piece: WQ, to: ORIGIN },
  { kind: 'place', piece: BQ, to: E },
  { kind: 'place', piece: WA, to: W },
  { kind: 'place', piece: BA, to: EE },
  { kind: 'relocate', from: W, to: { q: 0, r: -1 } },
];

const played = (): GameState => SCRIPT.reduce(applyMove, createGame());

const SPIDERLESS: Ruleset = { pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } };

const BP: Piece = { type: 'pillbug', color: 'black' };
const WB: Piece = { type: 'beetle', color: 'white' };

const N: HexCoord = { q: 0, r: -1 };
const NE: HexCoord = { q: 1, r: -1 };
const SW: HexCoord = { q: -1, r: 1 };
const WW: HexCoord = { q: -2, r: 1 };

// Black's pillbug lifts the white queen out of the centre, so the last move
// moves a piece the player to move does not own and leaves it stunned.
const THROWN: readonly Move[] = [
  { kind: 'place', piece: WQ, to: ORIGIN },
  { kind: 'place', piece: BP, to: W },
  { kind: 'place', piece: WB, to: NE },
  { kind: 'place', piece: BQ, to: WW },
  { kind: 'relocate', from: NE, to: N },
  { kind: 'throw', by: W, from: ORIGIN, to: SW },
];

describe('replayFrames', () => {
  it('returns one frame per move plus the opening position', () => {
    const frames = replayFrames(SCRIPT, BASE_RULESET);
    expect(frames).toHaveLength(SCRIPT.length + 1);
    expect(frames[0]).toEqual(createGame());
  });

  it('rebuilds the state the moves were taken from', () => {
    expect(replayFrames(SCRIPT, BASE_RULESET).at(-1)).toEqual(played());
  });

  it('grows the history by one move per frame', () => {
    const frames = replayFrames(SCRIPT, BASE_RULESET);
    expect(frames.map((f) => f.history.length)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frames[3]?.history).toEqual(SCRIPT.slice(0, 3));
  });

  it('returns just the opening position for an empty history', () => {
    expect(replayFrames([], BASE_RULESET)).toEqual([createGame()]);
  });

  it('replays under the ruleset it is given, not the base one', () => {
    const frames = replayFrames(SCRIPT, SPIDERLESS);

    expect(frames[0]).toEqual(createGame(SPIDERLESS));
    expect(frames.at(-1)?.hands.white).not.toHaveProperty('spider');
  });

  it('rejects a history playing a piece the ruleset never dealt', () => {
    const withSpider: Move[] = [
      { kind: 'place', piece: WQ, to: ORIGIN },
      { kind: 'place', piece: BQ, to: E },
      { kind: 'place', piece: { type: 'spider', color: 'white' }, to: W },
    ];
    expect(() => replayFrames(withSpider, SPIDERLESS)).toThrow(IllegalMoveError);
  });

  it('rebuilds a position a throw moved a piece into', () => {
    const frames = replayFrames(THROWN, PILLBUG_RULESET);

    expect(frames.at(-1)).toEqual(THROWN.reduce(applyMove, createGame(PILLBUG_RULESET)));
    expect(frames.at(-1)?.board.cells.get('-1,1')).toEqual([WQ]);
  });

  it('carries the stun a throw left behind into the replayed position', () => {
    const replayed = replayFrames(THROWN, PILLBUG_RULESET).at(-1);

    // White is to move and the thrown queen is the one piece it may not move.
    expect(replayed?.currentPlayer).toBe('white');
    const moves = listValidMoves(replayed as GameState);
    expect(moves).toContainEqual({ kind: 'relocate', from: N, to: ORIGIN });
    expect(moves).not.toContainEqual(expect.objectContaining({ kind: 'relocate', from: SW }));
  });

  it('throws on a history that no longer validates', () => {
    const tampered: Move[] = [...SCRIPT];
    tampered[2] = { kind: 'place', piece: WA, to: { q: 5, r: 5 } };
    expect(() => replayFrames(tampered, BASE_RULESET)).toThrow(IllegalMoveError);
  });
});
