import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('authentication', () => {
  test('registration logs the player in and the session survives a reload', async ({ page }) => {
    await registerAndLogin(page, 'Browser Explorer');
    await expect(page.getByRole('link', { name: 'Play a round', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('link', { name: 'Play a round', exact: true })).toBeVisible();
  });

  test('logout returns to the signed-out landing page, and the account can log back in', async ({ page }) => {
    const { email, password } = await registerAndLogin(page, 'Logout Tester');

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign up to play' })).toBeVisible();

    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: false }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Play a round', exact: true })).toBeVisible();
  });

  test('an incorrect password shows an inline error instead of logging in', async ({ page }) => {
    const { email } = await registerAndLogin(page, 'Wrong Password');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();

    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: false }).fill('definitely-the-wrong-password');
    await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(/incorrect email or password/i);
  });

  test('registering with a too-short password is rejected before it reaches the server', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign up' }).first().click();
    await page.getByRole('button', { name: 'Continue with Email' }).click();
    await page.getByLabel('Display name').fill('Short Password');
    await page.getByLabel('Email').fill(`short-${Date.now()}@example.test`);
    const passwordField = page.getByLabel('Password', { exact: false });
    await passwordField.fill('tooshort');
    await expect(passwordField).toHaveJSProperty('validity.valid', false);
  });
});
