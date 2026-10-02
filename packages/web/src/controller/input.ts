import type { Color, HexCoord, PieceType } from '@termitary/engine';
import { type Selection, gameStore } from '../store/store.js';
import { type Interaction, anchorOf, coordKey, interaction, sameCoord } from './interaction.js';
import type { Controller } from './port.js';

export type InputHandlers = {
  readonly handleBoardPieceClick: (coord: HexCoord) => void;
  readonly handleClearSelection: () => void;
  readonly handleHandSlotClick: (color: Color, type: PieceType) => void;
  readonly handlePassClick: () => void;
  readonly handleTargetClick: (coord: HexCoord) => void;
};

/**
 * Where a click on an occupied cell leaves the selection, in precedence order.
 * `undefined` leaves it untouched, which is not the same as clearing it: a
 * click on a piece with nothing to offer must not cancel what is already held.
 */
const nextSelection = (
  current: Selection,
  coord: HexCoord,
  can: Interaction,
): Selection | undefined => {
  const anchor = anchorOf(current);
  if (anchor !== null && sameCoord(anchor, coord)) return null;
  if (current?.kind === 'throw' && sameCoord(current.from, coord)) {
    return { kind: 'board', coord: current.by };
  }
  // Throwing wins over selecting: a neighbour of the selected pillbug that
  // could also move on its own is being picked up, not picked instead.
  if (anchor !== null && can.throwable.has(coordKey(coord))) {
    return { kind: 'throw', by: anchor, from: coord };
  }
  if (can.movable.has(coordKey(coord))) return { kind: 'board', coord };
  return undefined;
};

export const createInputHandlers = (
  controller: Controller,
  myColor: Color | null,
): InputHandlers => {
  const handleBoardPieceClick = (coord: HexCoord): void => {
    const state = gameStore.getState();
    const can = interaction(state, myColor);
    if (can.actor === null) return;

    const next = nextSelection(state.selection, coord, can);
    if (next !== undefined) state.setSelection(next);
  };

  const handleClearSelection = (): void => {
    gameStore.getState().setSelection(null);
  };

  const handleHandSlotClick = (color: Color, type: PieceType): void => {
    const state = gameStore.getState();
    const can = interaction(state, myColor);
    if (can.actor !== color || !can.placeable.has(type)) return;

    const held = state.selection?.kind === 'hand' && state.selection.piece === type;
    state.setSelection(held ? null : { kind: 'hand', piece: type });
  };

  const handlePassClick = (): void => {
    if (!interaction(gameStore.getState(), myColor).canPass) return;
    controller.commitMove({ kind: 'pass' });
  };

  const handleTargetClick = (coord: HexCoord): void => {
    const move = interaction(gameStore.getState(), myColor).targets.get(coordKey(coord));
    if (move === undefined) return;
    controller.commitMove(move);
  };

  return {
    handleBoardPieceClick,
    handleClearSelection,
    handleHandSlotClick,
    handlePassClick,
    handleTargetClick,
  };
};
