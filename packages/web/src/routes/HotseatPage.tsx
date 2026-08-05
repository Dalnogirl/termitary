import { BoardCanvas } from '../board/BoardCanvas.js';
import { Modal } from '../game-over/Modal.js';
import { Hand } from '../hand/Hand.js';

export const HotseatPage = () => (
  <div id="app">
    <Hand color="black" />
    <BoardCanvas />
    <Hand color="white" />
    <Modal />
  </div>
);
