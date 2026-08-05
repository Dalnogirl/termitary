import { type HexCoord, type Move, IllegalMoveError, applyMove } from '@hive/engine';
import { commit, getState, setSelection } from '../store/store.js';

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

export const handleBoardPieceClick = (coord: HexCoord): void => {
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

export const handleBackgroundClick = (): void => {
  setSelection(null);
};

export const handlePassClick = (): void => {
  const state = getState();
  if (state.game.status !== 'in_progress') return;
  const passMove = state.validMoves.find((m) => m.kind === 'pass');
  if (!passMove || state.validMoves.length !== 1) return;
  try {
    commit(applyMove(state.game, passMove));
  } catch (e) {
    if (e instanceof IllegalMoveError) {
      console.warn('IllegalMoveError on pass:', e.message);
      return;
    }
    throw e;
  }
};

export const handleTargetClick = (coord: HexCoord): void => {
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

  try {
    commit(applyMove(state.game, move));
  } catch (e) {
    if (e instanceof IllegalMoveError) {
      console.warn('IllegalMoveError despite validMoves filter:', e.message);
      setSelection(null);
      return;
    }
    throw e;
  }
};
