import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('navigation', () => {
  test('signed-out visitors can open Duels while account settings stay gated', async ({ page }) => {
    await page.goto('/duels');
    await expect(page.getByRole('heading', { name: 'Duels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Guest', { exact: true })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByText(/sign in to manage your account/i)).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'TerraGuessr home' })).toBeVisible();
    expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
    await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toHaveCount(0);
  });

  test('game cards and the shared home link navigate while daily and settings routes remain available', async ({ page }) => {
    await registerAndLogin(page, 'Nav Tester');

    await page.getByRole('link', { name: 'Multiplayer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Duels' })).toBeVisible();
    await expect(page).toHaveURL(/\/duels$/);

    await page.getByRole('link', { name: 'Singleplayer', exact: true }).click();
    await expect(page.getByRole('main', { name: 'TerraGuessr singleplayer game' })).toBeVisible();
    await expect(page).toHaveURL(/\/game\/singleplayer$/);

    await page.goto('/');
    await expect(page.getByRole('complementary', { name: 'Daily activities' })).toHaveCount(0);
    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily$/);

    await page.goto('/');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
