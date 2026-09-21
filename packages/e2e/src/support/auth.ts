import { type Browser, type Page, expect } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

// Only the e2e entry point serves this; the real server prints the code and
// forgets it.
const otpFor = async (page: Page, email: string): Promise<string> => {
  let otp = '';
  await expect
    .poll(async () => {
      const res = await page.request.get(`${API_URL}/e2e/otp`, { params: { email } });
      if (!res.ok()) return false;
      otp = ((await res.json()) as { otp: string }).otp;
      return true;
    })
    .toBe(true);
  return otp;
};

/** The real two-step form, so the OTP flow is under test rather than stubbed. */
export const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto('/signin');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByPlaceholder('000000').fill(await otpFor(page, email));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/lobby');
};

/**
 * A player of their own, in a context of their own: separate cookie jar,
 * separate socket, same server.
 */
export const signedInPlayer = async (browser: Browser, email: string): Promise<Page> => {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
};
