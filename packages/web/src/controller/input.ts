import type { HexCoord, Move } from '@hive/engine';
import { getState, setSelection } from '../store/store.js';
import type { Controller } from './port.js';

export type InputHandlers = {
  readonly handleBoardPieceClick: (coord: HexCoord) => void;
  readonly handleBackgroundClick: () => void;
  readonly handlePassClick: () => void;
  readonly handleTargetClick: (coord: HexCoord) => void;
};

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

export const createInputHandlers = (controller: Controller): InputHandlers => {
  const handleBoardPieceClick = (coord: HexCoord): void => {
    const state = getState();
    if (state.game.status !== 'in_progress') return;

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
    const passMove = state.validMoves.find((m) => m.kind === 'pass');
    if (!passMove || state.validMoves.length !== 1) return;
    controller.commitMove(passMove);
  };

  const handleTargetClick = (coord: HexCoord): void => {
    const state = getState();
    if (state.game.status !== 'in_progress') return;
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
