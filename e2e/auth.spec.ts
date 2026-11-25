import { expect, test } from '@playwright/test';
import { registerAndSignIn } from './support/auth';

test.describe('authentication and account settings', () => {
  test('registration persists across reload, supports logout and sign-in, and rejects wrong passwords', async ({ page }) => {
    const { email, password } = await registerAndSignIn(page, 'Atlas Runner');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    const sessionRes = await page.request.get('/api/auth/session');
    expect((await sessionRes.json()).user?.email).toBe(email);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.locator('main').getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/auth');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong password value');
    await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Password').fill(password);
    await page.locator('main').getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  });

  test('updates display name and permanently deletes account from settings', async ({ page }) => {
    const { password } = await registerAndSignIn(page, 'Original Name');

    await page.goto('/settings');
    const nameField = page.getByLabel('Display name');
    await expect(nameField).toHaveValue('Original Name');
    await nameField.fill('Updated Name');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText('Display name updated.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Display name')).toHaveValue('Updated Name');

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('DELETE').fill('DELETE');
    await dialog.getByPlaceholder('Current password (if set)').fill(password);
    await dialog.getByRole('button', { name: 'Delete forever' }).click();

    await expect(page).toHaveURL(/\/$/);
    const sessionAfter = await page.request.get('/api/auth/session');
    expect((await sessionAfter.json()).user).toBeNull();
  });
});
