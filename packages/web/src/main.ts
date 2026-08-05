import { createRenderer } from './board/renderer.js';
import {
  handleBackgroundClick,
  handleBoardPieceClick,
  handleTargetClick,
} from './controller/input.js';
import { createGameOverModal } from './game-over/modal.js';
import { createHandView } from './hand/view.js';
import { getState, subscribe } from './store/store.js';

const app = document.querySelector<HTMLDivElement>('#app');
const handTop = document.querySelector<HTMLDivElement>('#hand-top');
const handBottom = document.querySelector<HTMLDivElement>('#hand-bottom');
const boardEl = document.querySelector<HTMLDivElement>('#board');
if (!app || !handTop || !handBottom || !boardEl) {
  throw new Error('Required DOM elements missing');
}

createHandView(handTop, 'black');
createHandView(handBottom, 'white');
createGameOverModal(app);

const renderer = createRenderer(boardEl, {
  onTargetClick: handleTargetClick,
  onPieceClick: handleBoardPieceClick,
  onBackgroundClick: handleBackgroundClick,
});
subscribe((state) => renderer.draw(state));
renderer.draw(getState());
