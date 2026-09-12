import {
  type GameState,
  type Move,
  applyMove,
  createGame,
  listValidMoves,
} from '@termitary/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameStore, isLive } from './store.js';

const advance = (game: GameState, plies: number): GameState => {
  let cur = game;
  for (let i = 0; i < plies; i++) {
    const move = listValidMoves(cur)[0];
    if (move === undefined) break;
    cur = applyMove(cur, move);
  }
  return cur;
};

const FOUR_PLIES = advance(createGame(), 4);

describe('store view', () => {
  beforeEach(() => {
    gameStore.getState().reset();
  });

  it('starts live, with the live game as the view by identity', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    const s = gameStore.getState();
    expect(isLive(s)).toBe(true);
    expect(s.view).toBe(s.liveGame);
    expect(s.viewIndex).toBe(4);
    expect(s.frames).toBeNull();
  });

  it('shows the position after the scrubbed-to move without touching liveGame', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setViewIndex(2);

    const s = gameStore.getState();
    expect(s.liveGame).toBe(FOUR_PLIES);
    expect(s.view.history).toEqual(FOUR_PLIES.history.slice(0, 2));
    expect(s.lastMove).toEqual(FOUR_PLIES.history[1]);
    expect(isLive(s)).toBe(false);
  });

  it('offers no moves and drops the selection off-live', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setSelection({ kind: 'hand', piece: 'ant' });
    gameStore.getState().setViewIndex(1);

    expect(gameStore.getState().validMoves).toEqual([]);
    expect(gameStore.getState().selection).toBeNull();
  });

  it('clamps an index past either end of the history', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setViewIndex(99);
    expect(gameStore.getState().viewIndex).toBe(4);

    gameStore.getState().setViewIndex(-3);
    expect(gameStore.getState().viewIndex).toBe(0);
    expect(gameStore.getState().view.history).toEqual([]);
    expect(gameStore.getState().lastMove).toBeNull();
  });

  it('computes the frames once, on the first scrub', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    expect(gameStore.getState().frames).toBeNull();

    gameStore.getState().setViewIndex(1);
    const frames = gameStore.getState().frames;
    expect(frames).toHaveLength(5);

    gameStore.getState().setViewIndex(3);
    expect(gameStore.getState().frames).toBe(frames);
  });

  it('returns to live with validMoves restored', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setViewIndex(0);
    gameStore.getState().returnToLive();

    const s = gameStore.getState();
    expect(isLive(s)).toBe(true);
    expect(s.view).toBe(FOUR_PLIES);
    expect(s.validMoves).toEqual(listValidMoves(FOUR_PLIES));
  });

  it('snaps a scrubbed board back to live when a new move lands', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setViewIndex(1);

    const next = advance(FOUR_PLIES, 1);
    gameStore.getState().applyGameState(next);

    const s = gameStore.getState();
    expect(isLive(s)).toBe(true);
    expect(s.view).toBe(next);
    expect(s.frames).toBeNull();
  });

  it('leaves a live board and its selection alone when stepping past the end', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    gameStore.getState().setSelection({ kind: 'hand', piece: 'ant' });
    const before = gameStore.getState();

    gameStore.getState().setViewIndex(before.viewIndex + 1);

    expect(gameStore.getState().selection).toEqual({ kind: 'hand', piece: 'ant' });
    expect(gameStore.getState().validMoves).toBe(before.validMoves);
  });

  it('reports the move that produced the live board as lastMove', () => {
    gameStore.getState().applyGameState(FOUR_PLIES);
    const last: Move | undefined = FOUR_PLIES.history.at(-1);
    expect(gameStore.getState().lastMove).toEqual(last);
  });
});
