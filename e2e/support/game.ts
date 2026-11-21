import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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
  if ((page.viewportSize()?.width ?? 1280) <= 1200) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await page.getByRole('button', { name: 'Sign up' }).first().click();
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible({ timeout: 15000 });

  const session = await page.request.get('/api/auth/session');
  expect(session.ok()).toBe(true);
  expect((await session.json()).user.displayName).toBe(displayName);

  return { email, password };
}
