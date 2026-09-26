import { type Page, expect, test } from '@playwright/test';
import { signedInPlayer } from './support/auth.js';

const roomPosts = (page: Page): string[] => {
  const posts: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/rooms') {
      posts.push(req.url());
    }
  });
  return posts;
};

test('one player seeks from the lobby, another joins it, and both reach the board', async ({
  browser,
}) => {
  const stamp = Date.now();
  const seeker = await signedInPlayer(browser, `seeker-${stamp}@test.dev`);
  const seekerPosts = roomPosts(seeker);

  // A required ladybug marks the row on the other side and proves the terms
  // travel into the paired ruleset.
  await seeker
    .getByRole('group', { name: 'Ladybug' })
    .locator('label', { has: seeker.getByRole('radio', { name: 'Yes' }) })
    .click();
  await seeker.getByRole('button', { name: 'Play', exact: true }).click();

  const mySeek = seeker.getByRole('listitem').filter({ hasText: 'Your seek' });
  await expect(mySeek).toContainText('Ladybug');
  await expect(seeker.getByRole('button', { name: 'Looking for an opponent…' })).toBeDisabled();

  const joiner = await signedInPlayer(browser, `joiner-${stamp}@test.dev`);
  const joinerPosts = roomPosts(joiner);
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

  for (const page of [seeker, joiner]) {
    await expect(page.getByText('Waiting for opponent…')).toBeHidden();
    await expect(page.locator('button[aria-label^="ladybug,"]').first()).toBeVisible();
  }

  expect([...seekerPosts, ...joinerPosts]).toEqual([]);
});

test('cancelling a seek leaves the player in the lobby', async ({ browser }) => {
  const player = await signedInPlayer(browser, `canceller-${Date.now()}@test.dev`);
  await player.getByRole('button', { name: 'Play', exact: true }).click();

  const mySeek = player.getByRole('listitem').filter({ hasText: 'Your seek' });
  await expect(mySeek).toBeVisible();
  await player.getByRole('button', { name: 'Cancel' }).click();
  await expect(mySeek).toBeHidden();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

  // Longer than the lobby spends looking for a room after a seek goes.
  await player.waitForTimeout(3_000);
  expect(new URL(player.url()).pathname).toBe('/lobby');
});
