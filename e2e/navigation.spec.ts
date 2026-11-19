import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('navigation', () => {
  test('signed-out visitors can open Duels while account settings stay gated', async ({ page }) => {
    await page.goto('/duels');
    await expect(page.getByRole('heading', { name: 'Duels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.locator('.tg-dl-player-name--left')).toHaveText('Guest');

    await page.goto('/settings');
    await expect(page.getByText(/sign in to manage your account/i)).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    await expect(page.getByText('Guest', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toHaveCount(0);
  });

  test('the header nav links and daily-challenge card route to the right pages once signed in', async ({ page }) => {
    await registerAndLogin(page, 'Nav Tester');

    await page.getByRole('link', { name: 'Multiplayer' }).click();
    await expect(page.getByRole('heading', { name: 'Duels' })).toBeVisible();
    await expect(page).toHaveURL(/\/duels$/);

    await page.getByRole('link', { name: 'Singleplayer' }).click();
    await expect(page.getByRole('button', { name: 'Start playing' })).toBeVisible();
    await expect(page).toHaveURL(/\/play$/);

    await page.goto('/');
    await page.getByText('Daily Challenge').click();
    await expect(page).toHaveURL(/\/daily$/);

    await page.goto('/');
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
