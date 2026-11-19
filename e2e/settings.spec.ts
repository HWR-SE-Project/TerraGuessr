import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('settings', () => {
  test('display name can be updated and the change is reflected after reload', async ({ page }) => {
    await registerAndLogin(page, 'Original Name');
    await page.goto('/settings');

    const nameField = page.getByLabel('Display name');
    await expect(nameField).toHaveValue('Original Name');
    await nameField.fill('Updated Name');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Display name')).toHaveValue('Updated Name');
  });

  test('a preference change persists across reload', async ({ page }) => {
    await registerAndLogin(page, 'Preference Tester');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();

    await page.getByLabel('Language').selectOption('de');
    await expect(page.getByLabel('Language')).toHaveValue('de');

    await page.reload();
    await page.getByRole('button', { name: 'Preferences' }).click();
    await expect(page.getByLabel('Language')).toHaveValue('de');
  });

  test('deleting the account requires confirmation and then signs the player out', async ({ page }) => {
    const { password } = await registerAndLogin(page, 'Delete Me');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete my account' }).click();

    await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeVisible();
    await page.getByLabel('Current password').fill(password);
    await page.getByRole('button', { name: 'Delete account' }).click();

    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
  });
});
