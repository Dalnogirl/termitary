import {
  type GameState,
  type HexCoord,
  type Move,
  type PieceType,
  createGame,
  listValidMoves,
} from '@hive/engine';
import { type StateCreator, createStore, useStore } from 'zustand';
import { devtools } from 'zustand/middleware';

export type Selection =
  | { readonly kind: 'hand'; readonly piece: PieceType }
  | { readonly kind: 'board'; readonly coord: HexCoord }
  | null;

export type StoreState = {
  readonly game: GameState;
  readonly validMoves: readonly Move[];
  readonly selection: Selection;
};

type StoreActions = {
  readonly applyGameState: (game: GameState) => void;
  readonly setSelection: (selection: Selection) => void;
  readonly reset: () => void;
};

export type GameStore = StoreState & StoreActions;

const initialState = (): StoreState => {
  const game = createGame();
  return { game, validMoves: listValidMoves(game), selection: null };
};

const initializer: StateCreator<GameStore, [['zustand/devtools', never]]> = (set) => ({
  ...initialState(),
  applyGameState: (game) =>
    set({ game, validMoves: listValidMoves(game), selection: null }, false, 'applyGameState'),
  setSelection: (selection) => set({ selection }, false, 'setSelection'),
  reset: () => set(initialState(), false, 'reset'),
});

export const gameStore = createStore<GameStore>()(
  devtools(initializer, { name: 'hive-game', enabled: import.meta.env.DEV }),
);

export const useGameStore = <T>(selector: (s: GameStore) => T): T => useStore(gameStore, selector);
