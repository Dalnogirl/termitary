import { useMemo } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { useDemoAutoplay } from './use-demo-autoplay.js';

export const DemoBoard = () => {
  const controller = useMemo(() => createLocalController(), []);
  useDemoAutoplay();

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <BoardCanvas />
      </InputProvider>
    </RoomProvider>
  );
};
