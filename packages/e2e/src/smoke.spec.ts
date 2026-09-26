import { expect, test } from '@playwright/test';
import { signIn } from './support/auth.js';
import { clickCell, hitAt, pieceAt } from './support/board.js';

const ORIGIN = { q: 0, r: 0 };

// One move, deliberately: it is the sign-in seam, the two origins, the hex
// helper and the reduced-motion setting all at once, and #113 is where depth
// belongs.
test('signs in, opens a room and places a piece by clicking the canvas', async ({ page }) => {
  await signIn(page, `smoke-${Date.now()}@test.dev`);

  // Home keeps the create dialog until #125; the lobby only seeks.
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new game' }).click();
  // The radio is sr-only under its glyph, so the label is what a player hits.
  await page.locator('label', { has: page.getByRole('radio', { name: /White/ }) }).click();
  await page.getByRole('button', { name: 'Create game' }).click();
  await page.waitForURL('**/play/**');

  await page.locator('button[aria-label^="queen,"]:not([disabled])').click();
  await expect.poll(() => hitAt(page, ORIGIN)).toBe('target');

  await clickCell(page, ORIGIN);

  await expect.poll(() => pieceAt(page, ORIGIN)).toEqual({ color: 'white', type: 'queen' });
});
