import { expect, test } from '@playwright/test';
import { clickCell, hitAt, pieceAt } from './support/board.js';

const ORIGIN = { q: 0, r: 0 };
const BESIDE_IT = { q: 1, r: 0 };

// `/hotseat` is a deep link, so reaching it at all is the SPA fallback working:
// the server has no such route and hands back index.html.
test('the built bundle serves a deep link and plays a move on the canvas', async ({ page }) => {
  await page.goto('/hotseat');
  await page.getByRole('button', { name: 'Start game' }).click();

  // Konva came through the bundler by its deep import paths, and the board is
  // the proof: nothing draws if `konva/lib/Stage.js` resolved to nothing.
  await page.locator('button[aria-label^="queen,"]:not([disabled])').click();
  await expect.poll(() => hitAt(page, ORIGIN)).toBe('target');
  await clickCell(page, ORIGIN);
  await expect.poll(() => pieceAt(page, ORIGIN)).toEqual({ color: 'white', type: 'queen' });

  // Black answering proves the engine advanced the turn, not just that a tile
  // was drawn where one was clicked.
  await page.locator('button[aria-label^="spider,"]:not([disabled])').click();
  await expect.poll(() => hitAt(page, BESIDE_IT)).toBe('target');
  await clickCell(page, BESIDE_IT);
  await expect.poll(() => pieceAt(page, BESIDE_IT)).toEqual({ color: 'black', type: 'spider' });
});
