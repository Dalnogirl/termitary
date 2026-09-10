import { useMemo, useRef } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { useDemoAutoplay } from './use-demo-autoplay.js';

export const DemoBoard = () => {
  const surface = useRef<HTMLDivElement>(null);
  const controller = useMemo(() => createLocalController(), []);
  useDemoAutoplay(surface);

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <div ref={surface} className="absolute inset-0">
          <BoardCanvas />
        </div>
      </InputProvider>
    </RoomProvider>
  );
};
