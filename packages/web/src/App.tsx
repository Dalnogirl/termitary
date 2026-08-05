import { useEffect, useRef } from 'react';
import { createRenderer } from './board/renderer.js';
import {
  handleBackgroundClick,
  handleBoardPieceClick,
  handleTargetClick,
} from './controller/input.js';
import { createGameOverModal } from './game-over/modal.js';
import { createHandView } from './hand/view.js';
import { getState, subscribe } from './store/store.js';

export const App = () => {
  const appRef = useRef<HTMLDivElement>(null);
  const handTopRef = useRef<HTMLDivElement>(null);
  const handBottomRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = appRef.current;
    const ht = handTopRef.current;
    const hb = handBottomRef.current;
    const board = boardRef.current;
    if (!app || !ht || !hb || !board) return;

    const handBlack = createHandView(ht, 'black');
    const handWhite = createHandView(hb, 'white');
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
      handBlack.destroy();
      handWhite.destroy();
      modal.destroy();
      renderer.destroy();
    };
  }, []);

  return (
    <div id="app" ref={appRef}>
      <div id="hand-top" ref={handTopRef} />
      <div id="board" ref={boardRef} />
      <div id="hand-bottom" ref={handBottomRef} />
    </div>
  );
};
