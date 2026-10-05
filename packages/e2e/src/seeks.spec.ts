import { type Page, expect, test } from '@playwright/test';
import { signedInPlayer } from './support/auth.js';

test('one player seeks from the lobby, another joins it, and both reach the board', async ({
  browser,
}) => {
  const stamp = Date.now();
  const seekerEmail = `seeker-${stamp}@test.dev`;
  const seeker = await signedInPlayer(browser, seekerEmail);

  // A required ladybug marks the row on the other side and proves the terms
  // travel into the paired ruleset.
  await seeker.getByRole('button', { name: 'Choose pieces' }).click();
  await seeker
    .getByRole('group', { name: 'Ladybug' })
    .locator('label', { has: seeker.getByRole('radio', { name: 'Yes' }) })
    .click();
  await seeker.getByRole('button', { name: 'Play', exact: true }).click();

  const waiting = seeker.getByRole('status').filter({ hasText: 'Looking for an opponent' });
  await expect(waiting).toContainText('Ladybug');

  const joinerEmail = `joiner-${stamp}@test.dev`;
  const joiner = await signedInPlayer(browser, joinerEmail);
  await joiner
    .getByRole('listitem')
    .filter({ hasText: 'Ladybug' })
    .getByRole('button', { name: 'Join' })
    .click();
  await joiner.waitForURL('**/play/**');

  // Nothing pushes the pairing to the seeker; the lobby's poll finds it and
  // takes them in without a click.
  await seeker.waitForURL('**/play/**', { timeout: 15_000 });
  expect(seeker.url()).toBe(joiner.url());

  // The nav links each player to their own profile by email, so the other
  // side's presence badge must link to that same href.
  const ownProfile = (page: Page, email: string) =>
    page.getByRole('link', { name: email }).getAttribute('href');
  const pairs = [
    [seeker, await ownProfile(joiner, joinerEmail)],
    [joiner, await ownProfile(seeker, seekerEmail)],
  ] as const;
  for (const [page, opponentHref] of pairs) {
    await expect(page.locator(`a[href="${opponentHref}"]`)).toBeVisible();
    await expect(page.locator('button[aria-label^="ladybug,"]').first()).toBeVisible();
  }
});

test('cancelling a seek leaves the player in the lobby', async ({ browser }) => {
  const player = await signedInPlayer(browser, `canceller-${Date.now()}@test.dev`);
  await player.getByRole('button', { name: 'Play', exact: true }).click();

  const waiting = player.getByRole('status').filter({ hasText: 'Looking for an opponent' });
  await expect(waiting).toBeVisible();
  await player.getByRole('button', { name: 'Cancel' }).click();
  await expect(waiting).toBeHidden();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

  // Longer than the lobby spends looking for a room after a seek goes.
  await player.waitForTimeout(3_000);
  expect(new URL(player.url()).pathname).toBe('/');
});
