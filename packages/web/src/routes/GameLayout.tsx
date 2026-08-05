import { BoardCanvas } from '../board/BoardCanvas.js';
import { Modal } from '../game-over/Modal.js';
import { Hand } from '../hand/Hand.js';
import { History } from '../history/History.js';

export const GameLayout = () => (
  <div className="flex flex-1 min-h-0">
    <div className="flex flex-col flex-1 min-w-0">
      <Hand color="black" />
      <BoardCanvas />
      <Hand color="white" />
    </div>
    <History />
    <Modal />
  </div>
);
