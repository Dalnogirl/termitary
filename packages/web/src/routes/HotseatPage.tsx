import { useEffect, useMemo } from 'react';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { reset } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

export const HotseatPage = () => {
  const controller = useMemo(() => createLocalController(), []);
  useEffect(() => {
    reset();
  }, []);

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <GameLayout />
      </InputProvider>
    </RoomProvider>
  );
};
