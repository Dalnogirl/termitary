import { createRenderer } from './board/renderer.js';
import { handleTargetClick } from './controller/input.js';
import { createHandView } from './hand/view.js';
import { getState, subscribe } from './store/store.js';

const handTop = document.querySelector<HTMLDivElement>('#hand-top');
const handBottom = document.querySelector<HTMLDivElement>('#hand-bottom');
const boardEl = document.querySelector<HTMLDivElement>('#board');
if (!handTop || !handBottom || !boardEl) {
  throw new Error('Required DOM elements missing');
}

createHandView(handTop, 'black');
createHandView(handBottom, 'white');

const renderer = createRenderer(boardEl, { onTargetClick: handleTargetClick });
subscribe((state) => renderer.draw(state));
renderer.draw(getState());
