import type { Color, HexCoord, Move } from '@termitary/engine';
import { type Selection, type StoreState, gameStore, isLive } from '../store/store.js';
import type { Controller } from './port.js';

export type InputHandlers = {
  readonly handleBoardPieceClick: (coord: HexCoord) => void;
  readonly handleClearSelection: () => void;
  readonly handlePassClick: () => void;
  readonly handleTargetClick: (coord: HexCoord) => void;
};

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

const canBeThrownBy = (moves: readonly Move[], by: HexCoord, from: HexCoord): boolean =>
  moves.some((m) => m.kind === 'throw' && sameCoord(m.by, by) && sameCoord(m.from, from));

// A piece worth selecting either goes somewhere itself or can throw. A pillbug
// hemmed in with a free neighbour has only the second.
const canAct = (moves: readonly Move[], coord: HexCoord): boolean =>
  moves.some(
    (m) =>
      (m.kind === 'relocate' && sameCoord(m.from, coord)) ||
      (m.kind === 'throw' && sameCoord(m.by, coord)),
  );

// The piece a click is measured against: the selected one, or, midway through a
// throw, the pillbug doing the throwing rather than the piece it picked up.
const anchorOf = (selection: Selection): HexCoord | null => {
  if (selection?.kind === 'board') return selection.coord;
  if (selection?.kind === 'throw') return selection.by;
  return null;
};

/**
 * Where a click on an occupied cell leaves the selection, in precedence order.
 * `undefined` leaves it untouched, which is not the same as clearing it: a
 * click on a piece with nothing to offer must not cancel what is already held.
 */
const nextSelection = (
  current: Selection,
  coord: HexCoord,
  moves: readonly Move[],
): Selection | undefined => {
  const anchor = anchorOf(current);
  if (anchor !== null && sameCoord(anchor, coord)) return null;
  if (current?.kind === 'throw' && sameCoord(current.from, coord)) {
    return { kind: 'board', coord: current.by };
  }
  // Throwing wins over selecting: a neighbour of the selected pillbug that
  // could also move on its own is being picked up, not picked instead.
  if (anchor !== null && canBeThrownBy(moves, anchor, coord)) {
    return { kind: 'throw', by: anchor, from: coord };
  }
  if (canAct(moves, coord)) return { kind: 'board', coord };
  return undefined;
};

/** The move a click on `coord` would commit, given what is currently held. */
const moveFor = (state: StoreState, coord: HexCoord, currentPlayer: Color): Move | undefined => {
  const sel = state.selection;
  if (sel === null) return undefined;
  if (sel.kind === 'hand') {
    return state.validMoves.find(
      (m) =>
        m.kind === 'place' &&
        m.piece.type === sel.piece &&
        m.piece.color === currentPlayer &&
        sameCoord(m.to, coord),
    );
  }
  if (sel.kind === 'board') {
    return state.validMoves.find(
      (m) => m.kind === 'relocate' && sameCoord(m.from, sel.coord) && sameCoord(m.to, coord),
    );
  }
  return state.validMoves.find(
    (m) =>
      m.kind === 'throw' &&
      sameCoord(m.by, sel.by) &&
      sameCoord(m.from, sel.from) &&
      sameCoord(m.to, coord),
  );
};

// In network play (myColor !== null), interaction is gated on whose turn it is:
// when it's not mine, validMoves describes the opponent's options, which the UI
// must neither highlight nor act on. In hot-seat (myColor === null), both sides
// are mine to play, so the gate is open.
//
// Stepping back through the history makes the board a read-only picture of an
// earlier position. validMoves is empty off-live, so every handler below would
// bail on its own lookup, but the rule belongs in one place.
const canPlay = (state: StoreState, myColor: Color | null): boolean =>
  isLive(state) &&
  state.view.status === 'in_progress' &&
  (myColor === null || myColor === state.view.currentPlayer);

export const createInputHandlers = (
  controller: Controller,
  myColor: Color | null,
): InputHandlers => {
  const handleBoardPieceClick = (coord: HexCoord): void => {
    const state = gameStore.getState();
    if (!canPlay(state, myColor)) return;

    const next = nextSelection(state.selection, coord, state.validMoves);
    if (next !== undefined) state.setSelection(next);
  };

  const handleClearSelection = (): void => {
    gameStore.getState().setSelection(null);
  };

  const handlePassClick = (): void => {
    const state = gameStore.getState();
    if (!canPlay(state, myColor)) return;

    const passMove = state.validMoves.find((m) => m.kind === 'pass');
    if (!passMove || state.validMoves.length !== 1) return;
    controller.commitMove(passMove);
  };

  const handleTargetClick = (coord: HexCoord): void => {
    const state = gameStore.getState();
    if (!canPlay(state, myColor)) return;

    const move = moveFor(state, coord, state.view.currentPlayer);
    if (move === undefined) return;
    controller.commitMove(move);
  };

  return { handleBoardPieceClick, handleClearSelection, handlePassClick, handleTargetClick };
};
