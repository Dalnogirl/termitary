import type { Controller } from './port.js';

// An archived game is always finished, so every handler in `input.ts` bails on
// `view.status` before it reaches a controller. This exists to satisfy
// InputProvider, and a call to it would be a bug in that gate.
export const reviewController: Controller = {
  commitMove: () => {},
};
