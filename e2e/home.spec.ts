import { expect, test } from '@playwright/test';

test.describe('home and primary navigation', () => {
  test('renders the home hero and navigates to core pages', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Small world\.\s*Big adventure\./i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play singleplayer' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Multiplayer' })).toBeVisible();

    await page.getByRole('button', { name: 'Play singleplayer' }).click();
    await expect(page).toHaveURL(/\/singleplayer$/);
    await expect(page.getByRole('heading', { name: 'Choose your challenge' })).toBeVisible();

    await page.goto('/multiplayer');
    await expect(page.getByRole('heading', { name: 'Play with friends' })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeVisible();
  });
});
