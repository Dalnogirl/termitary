import { useEffect, useRef } from 'react';
import { createRenderer } from './board/renderer.js';
import {
  handleBackgroundClick,
  handleBoardPieceClick,
  handleTargetClick,
} from './controller/input.js';
import { Modal } from './game-over/Modal.js';
import { Hand } from './hand/Hand.js';
import { getState, subscribe } from './store/store.js';

export const App = () => {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const renderer = createRenderer(board, {
      onTargetClick: handleTargetClick,
      onPieceClick: handleBoardPieceClick,
      onBackgroundClick: handleBackgroundClick,
    });

    const unsubscribe = subscribe((state) => renderer.draw(state));
    renderer.draw(getState());

    return () => {
      unsubscribe();
      renderer.destroy();
    };
  }, []);

  return (
    <div id="app">
      <Hand color="black" />
      <div id="board" ref={boardRef} />
      <Hand color="white" />
      <Modal />
    </div>
  );
};
