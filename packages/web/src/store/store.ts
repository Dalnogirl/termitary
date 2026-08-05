import {
  type Color,
  type GameState,
  type HexCoord,
  type Move,
  type PieceType,
  createGame,
  listValidMoves,
} from '@hive/engine';

export type Selection =
  | { readonly kind: 'hand'; readonly piece: PieceType }
  | { readonly kind: 'board'; readonly coord: HexCoord }
  | null;

export type StoreState = {
  readonly game: GameState;
  readonly validMoves: readonly Move[];
  readonly selection: Selection;
  // null = hot-seat (both colors playable by this client). When set by a
  // network route, the UI restricts interaction to the matching color.
  readonly myColor: Color | null;
};

type Subscriber = (state: StoreState) => void;

const initialGame = createGame();
let state: StoreState = {
  game: initialGame,
  validMoves: listValidMoves(initialGame),
  selection: null,
  myColor: null,
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
  // commit only touches game-derived fields; myColor is owned by the route.
  state = { ...state, game: next, validMoves: listValidMoves(next), selection: null };
  notify();
};

export const setSelection = (selection: Selection): void => {
  state = { ...state, selection };
  notify();
};

export const setMyColor = (color: Color | null): void => {
  state = { ...state, myColor: color };
  notify();
};

export const reset = (): void => commit(createGame());

if (import.meta.env.DEV) {
  (globalThis as Record<string, unknown>).__hive = {
    getState,
    subscribe,
    commit,
    reset,
  };
}
