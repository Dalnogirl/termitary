import { useEffect, useRef } from 'react';
import {
  handleBackgroundClick,
  handleBoardPieceClick,
  handleTargetClick,
} from '../controller/input.js';
import { getState, subscribe } from '../store/store.js';
import { createRenderer } from './renderer.js';

export const BoardCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = createRenderer(container, {
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

  return <div ref={containerRef} className="flex-1 relative overflow-hidden" />;
};
