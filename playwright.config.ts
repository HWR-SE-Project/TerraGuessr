import { defineConfig, devices } from '@playwright/test';

/**
 * O-01 (devops): Playwright is configured for the full-stack e2e suite (owned by
 * QA under e2e/). CI starts the whole stack via
 * `docker compose -f docker-compose.test.yml up --build`, so `webServer` is left
 * unset by default and `baseURL` comes from the environment.
 *
 * Set PLAYWRIGHT_BASE_URL to the frontend origin (default http://localhost:8080,
 * the port nginx is published on in docker-compose*.yml).
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The deterministic weather mock has mutable failure injection used by
  // R13; one worker keeps that scenario isolated from other browser games.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Optional local convenience: set PLAYWRIGHT_WEBSERVER to a command (e.g.
  // "npm run dev --prefix frontend") and Playwright will start/stop it for you.
  // In CI the stack is managed by docker compose instead.
  webServer: process.env.PLAYWRIGHT_WEBSERVER
    ? {
        command: process.env.PLAYWRIGHT_WEBSERVER,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
