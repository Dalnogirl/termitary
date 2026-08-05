import { useEffect, useMemo } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { InputProvider } from '../controller/InputProvider.js';
import { createLocalController } from '../controller/local.js';
import { Modal } from '../game-over/Modal.js';
import { Hand } from '../hand/Hand.js';
import { History } from '../history/History.js';
import { reset } from '../store/store.js';

export const HotseatPage = () => {
  const controller = useMemo(() => createLocalController(), []);
  useEffect(() => {
    reset();
  }, []);

  return (
    <InputProvider controller={controller}>
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          <Hand color="black" />
          <BoardCanvas />
          <Hand color="white" />
        </div>
        <History />
        <Modal />
      </div>
    </InputProvider>
  );
};
