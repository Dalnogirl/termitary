import { useEffect, useMemo } from 'react';
import { InputProvider } from '../controller/InputProvider.js';
import { createLocalController } from '../controller/local.js';
import { reset, setMyColor } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

export const HotseatPage = () => {
  const controller = useMemo(() => createLocalController(), []);
  useEffect(() => {
    reset();
    setMyColor(null);
  }, []);

  return (
    <InputProvider controller={controller}>
      <GameLayout />
    </InputProvider>
  );
};
