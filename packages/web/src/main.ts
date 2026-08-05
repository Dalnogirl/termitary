import { createGame } from '@hive/engine';

const state = createGame();
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `Hive scaffolding alive — engine status: ${state.status}, current player: ${state.currentPlayer}`;
}
