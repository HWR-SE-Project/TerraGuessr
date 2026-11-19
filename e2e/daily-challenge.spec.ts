import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

test('signed-in player can play and submit today\'s daily challenge once, and see the leaderboard', async ({ page }) => {
  await registerAndLogin(page, 'Daily Player');
  await page.goto('/daily');

  await expect(page.getByRole('heading', { name: 'Daily challenge' })).toBeVisible();
  await expect(page.getByTestId('weather-panel')).toBeVisible();

  await page.locator('.tg-daily-map .tg-map-picker').click({ position: { x: 150, y: 130 } });
  await page.getByRole('button', { name: 'Submit guess' }).click();

  await expect(page.locator('.tg-daily-result-value')).toBeVisible();
  await expect(page.getByText("Today's leaderboard")).toBeVisible();
  const rows = page.locator('.tg-daily-leaderboard-row');
  await expect(rows.filter({ hasText: 'Daily Player' })).toHaveCount(1);

  // Revisiting shows the already-completed state, not a second playable round.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Submit guess' })).toHaveCount(0);
  await expect(page.locator('.tg-daily-result-value')).toBeVisible();
});

test('signed-out visitor sees an honest sign-in prompt instead of a broken daily page', async ({ page }) => {
  await page.goto('/daily');
  await expect(page.getByText(/sign in to play today's shared challenge/i)).toBeVisible();
});
