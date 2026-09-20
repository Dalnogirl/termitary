import { describe, expect, it } from 'vitest';
import { replayFrames } from '../replay.js';
import { SURROUND_GAME } from './scripted-game.js';

describe('SURROUND_GAME', () => {
  it('ends with white winning by surround', () => {
    expect(SURROUND_GAME.final.result).toBe('white-wins');
    expect(SURROUND_GAME.final.endReason).toBe('queen-surrounded');
  });

  it('replays move for move to the position it claims', () => {
    const frames = replayFrames(SURROUND_GAME.moves, SURROUND_GAME.ruleset);
    expect(frames).toHaveLength(SURROUND_GAME.moves.length + 1);
    expect(frames.at(-1)?.board).toEqual(SURROUND_GAME.final.board);
  });

  it('is long enough to be worth driving through a client', () => {
    expect(SURROUND_GAME.moves.length).toBeGreaterThan(8);
  });
});
