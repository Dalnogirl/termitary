import { type Page, expect, test } from '@playwright/test';
import { API_URL } from './support/auth.js';
import { type SpawnedServer, startServer } from './support/servers.js';

const MISCONFIGURED_PORT = 3002;

// What the browser made of a credentialed cross-origin GET: the status when it
// let the page read the response, 'blocked' when CORS stopped it.
const fetchStatus = (page: Page, url: string): Promise<number | 'blocked'> =>
  page.evaluate(async (target) => {
    try {
      const res = await fetch(target, { credentials: 'include' });
      return res.status;
    } catch {
      return 'blocked' as const;
    }
  }, url);

test.describe('CORS', () => {
  let misconfigured: SpawnedServer | undefined;

  test.beforeAll(async () => {
    misconfigured = await startServer(MISCONFIGURED_PORT, { WEB_ORIGIN: 'http://localhost:9999' });
  });

  test.afterAll(() => {
    // Undefined when the boot above threw, which is the run that most needs the
    // port back.
    misconfigured?.stop();
  });

  test('a WEB_ORIGIN that is not the web app blocks the lobby fetch', async ({ page }) => {
    const url = misconfigured?.url;
    if (url === undefined) throw new Error('the misconfigured server never started');
    await page.goto('/');

    // `fetch` rejects the same way for a CORS block and for a server that is not
    // there, so both halves are pinned down first: the suite's own server
    // answers the browser, and the misconfigured one answers Node, where no
    // origin check applies. Only then does 'blocked' mean the browser refused it.
    expect(await fetchStatus(page, `${API_URL}/rooms`)).toBe(401);
    expect((await page.request.get(`${url}/rooms`)).status()).toBe(401);

    expect(await fetchStatus(page, `${url}/rooms`)).toBe('blocked');
  });
});
