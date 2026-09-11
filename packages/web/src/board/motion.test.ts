import { type GameState, applyMove, createGame, listValidMoves } from '@hive/engine';
import { describe, expect, it } from 'vitest';
import type { StoreState } from '../store/store.js';
import { appendedMove } from './motion.js';

const asStore = (game: GameState): StoreState => ({
  game,
  validMoves: listValidMoves(game),
  selection: null,
});

const advance = (game: GameState, plies: number): GameState => {
  let cur = game;
  for (let i = 0; i < plies; i++) {
    const move = listValidMoves(cur)[0];
    if (move === undefined) break;
    cur = applyMove(cur, move);
  }
  return cur;
};

describe('appendedMove', () => {
  const start = createGame();
  const afterOne = advance(start, 1);

  it('names the move when history grew by exactly one', () => {
    const move = appendedMove(asStore(start), asStore(afterOne));
    expect(move).toEqual(afterOne.history[0]);
  });

  it('snaps on a server echo, where history is unchanged', () => {
    expect(appendedMove(asStore(afterOne), asStore(afterOne))).toBeNull();
  });

  it('snaps on a rollback, where history got shorter', () => {
    expect(appendedMove(asStore(afterOne), asStore(start))).toBeNull();
  });

  it('snaps on a reconnect, where history jumped by many', () => {
    expect(appendedMove(asStore(start), asStore(advance(start, 6)))).toBeNull();
  });
});
