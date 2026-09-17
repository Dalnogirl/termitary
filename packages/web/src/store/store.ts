import {
  type GameState,
  type HexCoord,
  type Move,
  type PieceType,
  type Ruleset,
  createGame,
  listValidMoves,
  replayFrames,
} from '@termitary/engine';
import { toast } from 'sonner';
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
  readonly replayFailed: boolean;
  readonly validMoves: readonly Move[];
  readonly selection: Selection;
};

type StoreActions = {
  readonly applyGameState: (game: GameState) => void;
  readonly setSelection: (selection: Selection) => void;
  readonly setViewIndex: (index: number) => void;
  readonly returnToLive: () => void;
  readonly reset: (ruleset?: Ruleset) => void;
};

export type GameStore = StoreState & StoreActions;

const liveView = (
  liveGame: GameState,
  frames: readonly GameState[] | null,
  replayFailed = false,
): StoreState => ({
  liveGame,
  viewIndex: liveGame.history.length,
  view: liveGame,
  lastMove: liveGame.history.at(-1) ?? null,
  frames,
  replayFailed,
  validMoves: listValidMoves(liveGame),
  selection: null,
});

// replayFrames re-validates every move, so a history that was legal when it was
// stored and is not under the current rules throws here. Forward play does not
// depend on the rebuild, so the live board keeps going and only scrubbing dies.
const buildFrames = (state: StoreState): readonly GameState[] | null => {
  try {
    return replayFrames(state.liveGame.history, state.liveGame.ruleset);
  } catch (error) {
    console.error(error);
    toast.error('This game\u2019s history could not be rebuilt', { id: 'replay-failed' });
    return null;
  }
};

// Stepping back is the only thing that needs the intermediate positions, so a
// player who never opens the history pays nothing for them.
const viewAt = (state: StoreState, index: number): StoreState => {
  const liveIndex = state.liveGame.history.length;
  const viewIndex = Math.min(Math.max(index, 0), liveIndex);
  // Stepping past either end lands where you already are. Returning the same
  // state keeps zustand from notifying, so an arrow key at the live end cannot
  // clear a selection the player is midway through making.
  if (viewIndex === state.viewIndex) return state;
  if (viewIndex === liveIndex) return liveView(state.liveGame, state.frames, state.replayFailed);
  if (state.replayFailed) return state;

  const frames = state.frames ?? buildFrames(state);
  if (frames === null) return { ...state, replayFailed: true };

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

const initialState = (ruleset?: Ruleset): StoreState => liveView(createGame(ruleset), null);

const initializer: StateCreator<GameStore, [['zustand/devtools', never]]> = (set) => ({
  ...initialState(),
  applyGameState: (game) => set(liveView(game, null), false, 'applyGameState'),
  setSelection: (selection) => set({ selection }, false, 'setSelection'),
  setViewIndex: (index) => set((s) => viewAt(s, index), false, 'setViewIndex'),
  returnToLive: () => set((s) => viewAt(s, s.liveGame.history.length), false, 'returnToLive'),
  reset: (ruleset) => set(initialState(ruleset), false, 'reset'),
});

export const gameStore = createStore<GameStore>()(
  devtools(initializer, { name: 'termitary-game', enabled: import.meta.env.DEV }),
);

export const isLive = (state: StoreState): boolean =>
  state.viewIndex === state.liveGame.history.length;

export const useGameStore = <T>(selector: (s: GameStore) => T): T => useStore(gameStore, selector);
