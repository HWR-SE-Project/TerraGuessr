import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type SelectionMode = 'map' | 'list';

const FORBIDDEN_ACTUAL_KEYS = new Set(['actualLat', 'actualLon', 'actual', 'isActual']);

/** Deep-scan a value for R04-forbidden keys at any nesting depth. */
export function findActualKeys(value: unknown): string[] {
  const leaks: string[] = [];
  const stack: Array<[string, unknown]> = [['$', value]];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) continue;
    const [path, current] = entry;

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i += 1) {
        stack.push([path + '[' + i + ']', current[i]]);
      }
    } else if (current !== null && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (FORBIDDEN_ACTUAL_KEYS.has(key)) {
          leaks.push(path + '.' + key);
        }
        stack.push([path + '.' + key, child]);
      }
    }
  }

  return leaks;
}

// Live development servers enforce 10 registrations per minute. CI may leave
// this unset; shared local verification can opt into pacing without weakening
// the real server's account protections.
let lastRegistrationAt = 0;

/** Registers a brand-new account through the landing page's email form and waits for the home dashboard. */
export async function registerAndLogin(page: Page, displayName: string): Promise<{ email: string; password: string }> {
  const interval = Number(process.env.PLAYWRIGHT_REGISTRATION_INTERVAL_MS || 0);
  const wait = Math.max(0, lastRegistrationAt + interval - Date.now());
  if (wait) await page.waitForTimeout(wait);
  lastRegistrationAt = Date.now();
  const email = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}@example.test`;
  const password = 'correct-horse-battery-staple';

  await page.goto('/auth');
  await page.getByRole('button', { name: 'Sign up' }).first().click();
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name: 'Play Solo Challenge yourself', exact: true })).toBeVisible({ timeout: 15000 });

  const session = await page.request.get('/api/auth/session');
  expect(session.ok()).toBe(true);
  expect((await session.json()).user.displayName).toBe(displayName);

  return { email, password };
}

/** Fills out the real GameSetupForm (difficulty / map-or-list / round count) and starts a solo round. */
export async function startSoloGame(
  page: Page,
  options: { difficulty?: Difficulty; mode?: SelectionMode; rounds?: 3 | 5 | 10 } = {},
): Promise<void> {
  const { difficulty = 'medium', mode = 'map', rounds = 3 } = options;
  await page.goto('/play');
  await page.getByRole('button', { name: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), exact: true }).click();
  await page.getByRole('button', { name: mode === 'map' ? 'Click the map' : 'Pick from a list' }).click();
  await page.getByRole('button', { name: String(rounds), exact: true }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
}

/** Drops a guess on the map picker at a fixed, visible offset from its top-left. */
export async function guessOnMap(page: Page): Promise<void> {
  await page.locator('.tg-play-round-picker .tg-map-picker').click({ position: { x: 150, y: 130 } });
}
