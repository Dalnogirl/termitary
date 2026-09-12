import { describe, expect, it } from 'vitest';
import {
  type GameState,
  IllegalMoveError,
  type Move,
  applyMove,
  createGame,
} from './coordinator.js';
import type { HexCoord } from './hex.js';
import type { Piece } from './piece.js';
import { replayFrames } from './replay.js';

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

describe('replayFrames', () => {
  it('returns one frame per move plus the opening position', () => {
    const frames = replayFrames(SCRIPT);
    expect(frames).toHaveLength(SCRIPT.length + 1);
    expect(frames[0]).toEqual(createGame());
  });

  it('rebuilds the state the moves were taken from', () => {
    expect(replayFrames(SCRIPT).at(-1)).toEqual(played());
  });

  it('grows the history by one move per frame', () => {
    const frames = replayFrames(SCRIPT);
    expect(frames.map((f) => f.history.length)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frames[3]?.history).toEqual(SCRIPT.slice(0, 3));
  });

  it('returns just the opening position for an empty history', () => {
    expect(replayFrames([])).toEqual([createGame()]);
  });

  it('throws on a history that no longer validates', () => {
    const tampered: Move[] = [...SCRIPT];
    tampered[2] = { kind: 'place', piece: WA, to: { q: 5, r: 5 } };
    expect(() => replayFrames(tampered)).toThrow(IllegalMoveError);
  });
});
