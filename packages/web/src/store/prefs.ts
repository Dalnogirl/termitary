import { type StateCreator, createStore, useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type PieceSet, isPieceSet } from '../board/piece-sets.js';
import { type PieceHue, isPieceHue } from '../board/pieces.js';
import { type ExpansionPiece, isExpansionPiece } from '../rooms/expansions.js';

// Kept on the old `hive.` prefix through the rename to Termitary: renaming the
// key would reset every existing player's piece set and hue without an error.
const PIECE_SET_KEY = 'hive.pieceSet';
const PIECE_HUE_KEY = 'hive.pieceHue';
const EXPANSIONS_KEY = 'hive.expansions';
const ANIMATION_KEY = 'hive.animation';

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

// Unknown names are dropped rather than rejected, so a build that retires an
// expansion still reads a list written by one that had it.
const loadExpansions = (): readonly ExpansionPiece[] => {
  const stored = load(EXPANSIONS_KEY, (v): v is string => typeof v === 'string', '');
  return stored === '' ? [] : stored.split(',').filter(isExpansionPiece);
};

/** Whether a moving piece walks its route, or the board just snaps. */
export type Animation = 'on' | 'off';

const ANIMATIONS: readonly Animation[] = ['on', 'off'];

// Asked on every read rather than once at startup, so a player who has never
// opened Settings still gets the next move snapped when they turn the OS
// setting on mid-game.
const systemAnimation = (): Animation => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'on';
  } catch {
    return 'on';
  }
};

/**
 * `null` is a player who has never answered, not a third setting: the OS
 * decides for them, and their own answer wins from the moment they give one.
 */
export const resolveAnimation = (animation: Animation | null): Animation =>
  animation ?? systemAnimation();

const isAnimation = (v: unknown): v is Animation =>
  typeof v === 'string' && (ANIMATIONS as readonly string[]).includes(v);

export type PrefsState = {
  readonly pieceSet: PieceSet;
  readonly pieceHue: PieceHue;
  /** What a new-game dialog opens ticked, and what hot-seat deals before it is asked. */
  readonly expansions: readonly ExpansionPiece[];
  readonly animation: Animation | null;
};

type PrefsActions = {
  readonly setPieceSet: (pieceSet: PieceSet) => void;
  readonly setPieceHue: (pieceHue: PieceHue) => void;
  readonly setExpansions: (expansions: readonly ExpansionPiece[]) => void;
  readonly setAnimation: (animation: Animation) => void;
};

export type PrefsStore = PrefsState & PrefsActions;

const initializer: StateCreator<PrefsStore, [['zustand/devtools', never]]> = (set) => ({
  pieceSet: load(PIECE_SET_KEY, isPieceSet, 'chunky'),
  pieceHue: load(PIECE_HUE_KEY, isPieceHue, 'shared'),
  expansions: loadExpansions(),
  animation: load(ANIMATION_KEY, isAnimation, null),
  setPieceSet: (pieceSet) => {
    store(PIECE_SET_KEY, pieceSet);
    set({ pieceSet }, false, 'setPieceSet');
  },
  setPieceHue: (pieceHue) => {
    store(PIECE_HUE_KEY, pieceHue);
    set({ pieceHue }, false, 'setPieceHue');
  },
  setExpansions: (expansions) => {
    store(EXPANSIONS_KEY, expansions.join(','));
    set({ expansions }, false, 'setExpansions');
  },
  setAnimation: (animation) => {
    store(ANIMATION_KEY, animation);
    set({ animation }, false, 'setAnimation');
  },
});

export const prefsStore = createStore<PrefsStore>()(
  devtools(initializer, { name: 'termitary-prefs', enabled: import.meta.env.DEV }),
);

export const usePrefsStore = <T>(selector: (s: PrefsStore) => T): T =>
  useStore(prefsStore, selector);
