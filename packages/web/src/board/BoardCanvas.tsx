import { useEffect, useRef } from 'react';
import { useInputHandlers } from '../controller/InputProvider.js';
import { useRoomContext } from '../controller/RoomContext.js';
import { prefsStore } from '../store/prefs.js';
import { gameStore } from '../store/store.js';
import { createRenderer } from './renderer.js';

export const BoardCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlers = useInputHandlers();
  const { myColor } = useRoomContext();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = createRenderer(
      container,
      {
        onTargetClick: handlers.handleTargetClick,
        onPieceClick: handlers.handleBoardPieceClick,
        onClearSelection: handlers.handleClearSelection,
      },
      { myColor },
    );

    const unsubscribe = gameStore.subscribe((state) => renderer.draw(state));
    const unsubscribePrefs = prefsStore.subscribe(() => renderer.draw(gameStore.getState()));
    renderer.draw(gameStore.getState());

    return () => {
      unsubscribe();
      unsubscribePrefs();
      renderer.destroy();
    };
  }, [handlers, myColor]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden cursor-grab" />;
};
