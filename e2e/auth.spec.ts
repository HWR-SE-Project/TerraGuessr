import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('authentication', () => {
  test('registration logs the player in and the session survives a reload', async ({ page }) => {
    await registerAndLogin(page, 'Browser Explorer');
    await page.goto('/game/singleplayer');
    await expect(page.locator('.th-profile-name')).toHaveText('Browser Explorer');

    await page.reload();
    await expect(page.locator('.th-profile-name')).toHaveText('Browser Explorer');
  });

  test('logout returns to the guest home page, and the account can log back in', async ({ page }) => {
    const { email, password } = await registerAndLogin(page, 'Logout Tester');

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
    await page.goto('/auth');

    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: false }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    await page.goto('/game/singleplayer');
    await expect(page.locator('.th-profile-name')).toHaveText('Logout Tester');
  });

  test('an incorrect password shows an inline error instead of logging in', async ({ page }) => {
    const { email } = await registerAndLogin(page, 'Wrong Password');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
    await page.goto('/auth');

    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: false }).fill('definitely-the-wrong-password');
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(/incorrect email or password/i);
  });

  test('registering with a too-short password is rejected before it reaches the server', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Sign up' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Display name').fill('Short Password');
    await page.getByLabel('Email').fill(`short-${Date.now()}@example.test`);
    const passwordField = page.getByLabel('Password', { exact: false });
    await passwordField.fill('tooshort');
    await expect(passwordField).toHaveJSProperty('validity.valid', false);
  });
});
