import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test.describe('navigation', () => {
  test('signed-out visitors see honest gated states instead of broken pages', async ({ page }) => {
    await page.goto('/duels');
    await expect(page.getByRole('heading', { name: 'Duels' })).toBeVisible();
    await expect(page.getByText(/sign in to challenge a friend/i)).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByText(/sign in to manage your account/i)).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Sign up to play' })).toBeVisible();
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
