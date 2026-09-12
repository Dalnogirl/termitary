import { type StateCreator, createStore, useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type PieceSet, isPieceSet } from '../board/piece-sets.js';
import { type PieceHue, isPieceHue } from '../board/pieces.js';

// Kept on the old `hive.` prefix through the rename to Termitary: renaming the
// key would reset every existing player's piece set and hue without an error.
const PIECE_SET_KEY = 'hive.pieceSet';
const PIECE_HUE_KEY = 'hive.pieceHue';

// Storage throws outright in a private window with site data blocked, and holds
// whatever an older build wrote, so both directions are guarded.
const load = <T>(key: string, isValid: (v: unknown) => v is T, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return isValid(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const store = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A preference that cannot be remembered still works for this session.
  }
};

export type PrefsState = {
  readonly pieceSet: PieceSet;
  readonly pieceHue: PieceHue;
};

type PrefsActions = {
  readonly setPieceSet: (pieceSet: PieceSet) => void;
  readonly setPieceHue: (pieceHue: PieceHue) => void;
};

export type PrefsStore = PrefsState & PrefsActions;

const initializer: StateCreator<PrefsStore, [['zustand/devtools', never]]> = (set) => ({
  pieceSet: load(PIECE_SET_KEY, isPieceSet, 'chunky'),
  pieceHue: load(PIECE_HUE_KEY, isPieceHue, 'shared'),
  setPieceSet: (pieceSet) => {
    store(PIECE_SET_KEY, pieceSet);
    set({ pieceSet }, false, 'setPieceSet');
  },
  setPieceHue: (pieceHue) => {
    store(PIECE_HUE_KEY, pieceHue);
    set({ pieceHue }, false, 'setPieceHue');
  },
});

export const prefsStore = createStore<PrefsStore>()(
  devtools(initializer, { name: 'termitary-prefs', enabled: import.meta.env.DEV }),
);

export const usePrefsStore = <T>(selector: (s: PrefsStore) => T): T =>
  useStore(prefsStore, selector);
