import { useEffect, useRef } from 'react';
import { useInputHandlers } from '../controller/InputProvider.js';
import { getState, subscribe } from '../store/store.js';
import { createRenderer } from './renderer.js';

export const BoardCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlers = useInputHandlers();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = createRenderer(container, {
      onTargetClick: handlers.handleTargetClick,
      onPieceClick: handlers.handleBoardPieceClick,
      onBackgroundClick: handlers.handleBackgroundClick,
    });

    const unsubscribe = subscribe((state) => renderer.draw(state));
    renderer.draw(getState());

    return () => {
      unsubscribe();
      renderer.destroy();
    };
  }, [handlers]);

  return <div ref={containerRef} className="flex-1 relative overflow-hidden cursor-grab" />;
};
