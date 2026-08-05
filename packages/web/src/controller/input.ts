import type { Color, HexCoord, Move } from '@hive/engine';
import { getState, setSelection } from '../store/store.js';
import type { Controller } from './port.js';

export type InputHandlers = {
  readonly handleBoardPieceClick: (coord: HexCoord) => void;
  readonly handleBackgroundClick: () => void;
  readonly handlePassClick: () => void;
  readonly handleTargetClick: (coord: HexCoord) => void;
};

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

// In network play (myColor !== null), interaction is gated on whose turn it is:
// when it's not mine, validMoves describes the opponent's options, which the UI
// must neither highlight nor act on. In hot-seat (myColor === null), both sides
// are mine to play, so the gate is open.
const canInteract = (myColor: Color | null, currentPlayer: Color): boolean =>
  myColor === null || myColor === currentPlayer;

export const createInputHandlers = (
  controller: Controller,
  myColor: Color | null,
): InputHandlers => {
  const handleBoardPieceClick = (coord: HexCoord): void => {
    const state = getState();
    if (state.game.status !== 'in_progress') return;
    if (!canInteract(myColor, state.game.currentPlayer)) return;

    const cur = state.selection;
    if (cur?.kind === 'board' && sameCoord(cur.coord, coord)) {
      setSelection(null);
      return;
    }

    const hasRelocate = state.validMoves.some(
      (m) => m.kind === 'relocate' && sameCoord(m.from, coord),
    );
    if (!hasRelocate) return;

    setSelection({ kind: 'board', coord });
  };

  const handleBackgroundClick = (): void => {
    setSelection(null);
  };

  const handlePassClick = (): void => {
    const state = getState();
    if (state.game.status !== 'in_progress') return;
    if (!canInteract(myColor, state.game.currentPlayer)) return;
    const passMove = state.validMoves.find((m) => m.kind === 'pass');
    if (!passMove || state.validMoves.length !== 1) return;
    controller.commitMove(passMove);
  };

  const handleTargetClick = (coord: HexCoord): void => {
    const state = getState();
    if (state.game.status !== 'in_progress') return;
    if (!canInteract(myColor, state.game.currentPlayer)) return;
    const sel = state.selection;
    if (!sel) return;

    let move: Move | undefined;
    if (sel.kind === 'hand') {
      const player = state.game.currentPlayer;
      move = state.validMoves.find(
        (m) =>
          m.kind === 'place' &&
          m.piece.type === sel.piece &&
          m.piece.color === player &&
          sameCoord(m.to, coord),
      );
    } else {
      move = state.validMoves.find(
        (m) => m.kind === 'relocate' && sameCoord(m.from, sel.coord) && sameCoord(m.to, coord),
      );
    }
    if (!move) return;

    controller.commitMove(move);
  };

  return { handleBoardPieceClick, handleBackgroundClick, handlePassClick, handleTargetClick };
};
