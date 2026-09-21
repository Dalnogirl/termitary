import { defineConfig, devices } from '@playwright/test';
import { PROD_DATA_DIR } from './prod-paths.js';

const PORT = 3002;
const APP_URL = `http://localhost:${PORT}`;

/**
 * The bundle, served by a production server, on one origin. This is the only
 * check that runs built output: everything else in the repo passes on
 * TypeScript a dev server compiled on the fly.
 *
 * Hot-seat only, on purpose. Signing in needs an OTP, and the route that hands
 * one to a browser lives in `testing/e2e-server.ts` precisely so no production
 * boot serves it. Authenticated coverage waits for a real deployment to point
 * at.
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.prod.spec.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  workers: 1,
  use: {
    baseURL: APP_URL,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The wipe rides along with the boot because neither of the other two
    // places works: this file is re-imported by every worker, and globalSetup
    // runs after the web server is already up. Both delete the database out
    // from under a running server, which SQLite hides by writing on to the
    // unlinked file.
    command: 'rm -rf .tmp && mkdir -p .tmp && pnpm --filter @termitary/server start',
    url: `${APP_URL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      BETTER_AUTH_URL: APP_URL,
      DATABASE_URL: `${PROD_DATA_DIR}prod-e2e.db`,
      // Production refuses to boot without these. Nothing here signs in, so
      // they only have to exist.
      BETTER_AUTH_SECRET: 'prod-e2e-secret-not-a-real-one',
      GOOGLE_CLIENT_ID: 'prod-e2e',
      GOOGLE_CLIENT_SECRET: 'prod-e2e',
      GITHUB_CLIENT_ID: 'prod-e2e',
      GITHUB_CLIENT_SECRET: 'prod-e2e',
      ROOM_SWEEP_INTERVAL_MS: '0',
    },
  },
});
