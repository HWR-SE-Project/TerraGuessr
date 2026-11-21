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
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create account' }).click();
  const response = await registration;
  expect(response.ok()).toBe(true);
  if ((await response.json()).verificationRequired) {
    const mailpit = process.env.PLAYWRIGHT_MAILPIT_URL;
    if (!mailpit) throw new Error('This backend requires email verification. Set PLAYWRIGHT_MAILPIT_URL to the isolated test mailbox.');
    let messageId: string | undefined;
    await expect.poll(async () => {
      const search = await page.request.get(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
      expect(search.ok()).toBe(true);
      const messages = (await search.json()).messages;
      messageId = messages[0]?.ID;
      return messages.length;
    }).toBeGreaterThan(0);
    const message = await (await page.request.get(`${mailpit}/api/v1/message/${messageId}`)).json();
    const link = message.Text.match(/https?:\/\/[^\s<>"']+\/verify-email\?token=[^\s<>"']+/)?.[0];
    expect(link).toBeTruthy();
    await page.goto(`/verify-email${new URL(link).search}`);
    await expect(page.getByRole('heading', { name: 'Email verified', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go to sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: false }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible({ timeout: 15000 });

  const session = await page.request.get('/api/auth/session');
  expect(session.ok()).toBe(true);
  expect((await session.json()).user.displayName).toBe(displayName);

  return { email, password };
}
