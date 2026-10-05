import type { Color, HexCoord, Move, PieceType } from '@termitary/engine';
import { type Selection, type StoreState, isLive } from '../store/store.js';

export type BoardMove = Exclude<Move, { readonly kind: 'pass' }>;

/** What this client may do in the position on screen. Empty unless `actor` is set. */
export type Interaction = {
  readonly actor: Color | null;
  /** Pieces worth selecting: each goes somewhere itself or can throw. */
  readonly movable: ReadonlySet<string>;
  /** Neighbours the selected pillbug can pick up. */
  readonly throwable: ReadonlySet<string>;
  /** Every highlighted cell, keyed by `coordKey`, with the move a click there commits. */
  readonly targets: ReadonlyMap<string, BoardMove>;
  readonly placeable: ReadonlySet<PieceType>;
};

export const coordKey = (c: HexCoord): string => `${c.q},${c.r}`;

export const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

// The piece a click is measured against: the selected one, or, midway through a
// throw, the pillbug doing the throwing rather than the piece it picked up.
export const anchorOf = (selection: Selection): HexCoord | null => {
  if (selection?.kind === 'board') return selection.coord;
  if (selection?.kind === 'throw') return selection.by;
  return null;
};

/**
 * The side whose turn it is in the position on screen, when that side is this
 * client's to play. In network play (myColor !== null) validMoves describes the
 * opponent's options on their turn, which the UI must neither highlight nor act
 * on. In hot-seat (myColor === null) both sides are this client's.
 *
 * Holds while stepping through the history too, so a hand still shows whose
 * turn it was. Acting additionally needs the live position: see `interaction`.
 */
export const turnHolder = (state: StoreState, myColor: Color | null): Color | null => {
  const { view } = state;
  if (view.status !== 'in_progress') return null;
  if (myColor !== null && myColor !== view.currentPlayer) return null;
  return view.currentPlayer;
};

const completes = (selection: Selection, move: BoardMove): boolean => {
  switch (selection?.kind) {
    case 'hand':
      return move.kind === 'place' && move.piece.type === selection.piece;
    case 'board':
      return move.kind === 'relocate' && sameCoord(move.from, selection.coord);
    case 'throw':
      return (
        move.kind === 'throw' &&
        sameCoord(move.by, selection.by) &&
        sameCoord(move.from, selection.from)
      );
    default:
      return false;
  }
};

const NOTHING: Interaction = {
  actor: null,
  movable: new Set(),
  throwable: new Set(),
  targets: new Map(),
  placeable: new Set(),
};

const derive = (state: StoreState, myColor: Color | null): Interaction => {
  const actor = isLive(state) ? turnHolder(state, myColor) : null;
  if (actor === null) return NOTHING;

  const anchor = anchorOf(state.selection);
  const movable = new Set<string>();
  const throwable = new Set<string>();
  const targets = new Map<string, BoardMove>();
  const placeable = new Set<PieceType>();
  for (const m of state.validMoves) {
    if (m.kind === 'pass') continue;
    if (m.kind === 'place') placeable.add(m.piece.type);
    if (m.kind === 'relocate') movable.add(coordKey(m.from));
    if (m.kind === 'throw') {
      movable.add(coordKey(m.by));
      if (anchor !== null && sameCoord(m.by, anchor)) throwable.add(coordKey(m.from));
    }
    if (completes(state.selection, m)) targets.set(coordKey(m.to), m);
  }
  return { actor, movable, throwable, targets, placeable };
};

// One entry is enough: the renderer, the input handlers and both hands all ask
// about the store's current state. Returning the same object for it also keeps
// a zustand selector from re-rendering on every call.
let cached: {
  readonly state: StoreState;
  readonly myColor: Color | null;
  readonly result: Interaction;
} | null = null;

export const interaction = (state: StoreState, myColor: Color | null): Interaction => {
  if (cached?.state === state && cached.myColor === myColor) return cached.result;
  const result = derive(state, myColor);
  cached = { state, myColor, result };
  return result;
};
