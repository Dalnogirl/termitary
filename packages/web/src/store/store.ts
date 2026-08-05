import { type GameState, type Move, createGame, listValidMoves } from '@hive/engine';

export type StoreState = {
  readonly game: GameState;
  readonly validMoves: readonly Move[];
};

type Subscriber = (state: StoreState) => void;

const compute = (game: GameState): StoreState => ({
  game,
  validMoves: listValidMoves(game),
});

let state: StoreState = compute(createGame());
const subscribers = new Set<Subscriber>();

export const getState = (): StoreState => state;

export const subscribe = (fn: Subscriber): (() => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

export const commit = (next: GameState): void => {
  state = compute(next);
  for (const fn of subscribers) fn(state);
};

export const reset = (): void => commit(createGame());
