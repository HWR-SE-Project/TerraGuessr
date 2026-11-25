import { expect, type Page } from '@playwright/test';

let sequence = 0;

export async function registerAndSignIn(
  page: Page,
  displayName = 'Trail Blazer',
): Promise<{ email: string; password: string; displayName: string }> {
  sequence += 1;
  const email = `e2e-${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const password = 'correct horse battery staple';

  await page.goto('/auth');
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  return { email, password, displayName };
}
