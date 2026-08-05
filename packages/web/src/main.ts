import { createRenderer } from './board/renderer.js';
import { getState, subscribe } from './store/store.js';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app element not found');

const renderer = createRenderer(root);
subscribe((state) => renderer.draw(state));
renderer.draw(getState());
