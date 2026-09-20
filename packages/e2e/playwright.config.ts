import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './src',
  // Vitest owns `*.test.ts` and picks it up wherever it sits; nothing here is
  // ever named that.
  testMatch: '**/*.spec.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // One server process over one in-memory database serves every spec, so
  // parallel workers would be reading each other's lobby.
  workers: 1,
  use: {
    baseURL: WEB_URL,
    // `planMotion` returns null under this, so every move snaps and no wait is
    // ever a wait on an animation.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @termitary/server start:e2e',
      url: `${API_URL}/health`,
      // Both servers are unbuilt TypeScript started through pnpm, and a cold CI
      // runner does not make Playwright's 60s default.
      timeout: 120_000,
      // Never reuse: a `pnpm dev` server on this port has a real database and
      // no OTP route, and a suite that silently ran against it would fail
      // somewhere far from the cause.
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @termitary/web dev',
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
