import {
  type GameState,
  type HexCoord,
  type Move,
  type PieceType,
  createGame,
  listValidMoves,
  replayFrames,
} from '@termitary/engine';
import { type StateCreator, createStore, useStore } from 'zustand';
import { devtools } from 'zustand/middleware';

export type Selection =
  | { readonly kind: 'hand'; readonly piece: PieceType }
  | { readonly kind: 'board'; readonly coord: HexCoord }
  | null;

export type StoreState = {
  readonly liveGame: GameState;
  readonly viewIndex: number;
  readonly view: GameState;
  readonly lastMove: Move | null;
  readonly frames: readonly GameState[] | null;
  readonly validMoves: readonly Move[];
  readonly selection: Selection;
};

type StoreActions = {
  readonly applyGameState: (game: GameState) => void;
  readonly setSelection: (selection: Selection) => void;
  readonly setViewIndex: (index: number) => void;
  readonly returnToLive: () => void;
  readonly reset: () => void;
};

export type GameStore = StoreState & StoreActions;

const liveView = (liveGame: GameState, frames: readonly GameState[] | null): StoreState => ({
  liveGame,
  viewIndex: liveGame.history.length,
  view: liveGame,
  lastMove: liveGame.history.at(-1) ?? null,
  frames,
  validMoves: listValidMoves(liveGame),
  selection: null,
});

// Stepping back is the only thing that needs the intermediate positions, so a
// player who never opens the history pays nothing for them.
const viewAt = (state: StoreState, index: number): StoreState => {
  const liveIndex = state.liveGame.history.length;
  const viewIndex = Math.min(Math.max(index, 0), liveIndex);
  // Stepping past either end lands where you already are. Returning the same
  // state keeps zustand from notifying, so an arrow key at the live end cannot
  // clear a selection the player is midway through making.
  if (viewIndex === state.viewIndex) return state;
  if (viewIndex === liveIndex) return liveView(state.liveGame, state.frames);

  const frames = state.frames ?? replayFrames(state.liveGame.history);
  return {
    ...state,
    viewIndex,
    view: frames[viewIndex] ?? state.liveGame,
    lastMove: state.liveGame.history[viewIndex - 1] ?? null,
    frames,
    validMoves: [],
    selection: null,
  };
};

const initialState = (): StoreState => liveView(createGame(), null);

const initializer: StateCreator<GameStore, [['zustand/devtools', never]]> = (set) => ({
  ...initialState(),
  applyGameState: (game) => set(liveView(game, null), false, 'applyGameState'),
  setSelection: (selection) => set({ selection }, false, 'setSelection'),
  setViewIndex: (index) => set((s) => viewAt(s, index), false, 'setViewIndex'),
  returnToLive: () => set((s) => viewAt(s, s.liveGame.history.length), false, 'returnToLive'),
  reset: () => set(initialState(), false, 'reset'),
});

export const gameStore = createStore<GameStore>()(
  devtools(initializer, { name: 'termitary-game', enabled: import.meta.env.DEV }),
);

export const isLive = (state: StoreState): boolean =>
  state.viewIndex === state.liveGame.history.length;

export const useGameStore = <T>(selector: (s: GameStore) => T): T => useStore(gameStore, selector);
