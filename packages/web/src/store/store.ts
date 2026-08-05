import {
  type GameState,
  type Move,
  type PieceType,
  createGame,
  listValidMoves,
} from '@hive/engine';

export type Selection = { readonly kind: 'hand'; readonly piece: PieceType } | null;

export type StoreState = {
  readonly game: GameState;
  readonly validMoves: readonly Move[];
  readonly selection: Selection;
};

type Subscriber = (state: StoreState) => void;

const initialGame = createGame();
let state: StoreState = {
  game: initialGame,
  validMoves: listValidMoves(initialGame),
  selection: null,
};

const subscribers = new Set<Subscriber>();

const notify = (): void => {
  for (const fn of subscribers) fn(state);
};

export const getState = (): StoreState => state;

export const subscribe = (fn: Subscriber): (() => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

export const commit = (next: GameState): void => {
  state = { game: next, validMoves: listValidMoves(next), selection: null };
  notify();
};

export const setSelection = (selection: Selection): void => {
  state = { ...state, selection };
  notify();
};

export const reset = (): void => commit(createGame());
