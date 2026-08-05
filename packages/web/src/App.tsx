import { useEffect, useRef } from 'react';
import { createRenderer } from './board/renderer.js';
import {
  handleBackgroundClick,
  handleBoardPieceClick,
  handleTargetClick,
} from './controller/input.js';
import { createGameOverModal } from './game-over/modal.js';
import { Hand } from './hand/Hand.js';
import { getState, subscribe } from './store/store.js';

export const App = () => {
  const appRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = appRef.current;
    const board = boardRef.current;
    if (!app || !board) return;

    const modal = createGameOverModal(app);
    const renderer = createRenderer(board, {
      onTargetClick: handleTargetClick,
      onPieceClick: handleBoardPieceClick,
      onBackgroundClick: handleBackgroundClick,
    });

    const unsubscribe = subscribe((state) => renderer.draw(state));
    renderer.draw(getState());

    return () => {
      unsubscribe();
      modal.destroy();
      renderer.destroy();
    };
  }, []);

  return (
    <div id="app" ref={appRef}>
      <Hand color="black" />
      <div id="board" ref={boardRef} />
      <Hand color="white" />
    </div>
  );
};
