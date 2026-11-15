import { expect, test } from '@playwright/test';

test('authenticated player submits the shared UTC Daily Challenge once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Display name').fill('Daily Explorer');
  await page.getByLabel('Email address').fill(`daily-browser-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('secure browser password 2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your next expedition' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/phase4-daily-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: "Play today’s challenge" }).click();
  await expect(page.getByText(/Daily · \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(page.getByTestId('map-picker')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/phase4-daily-game.png', fullPage: true });
  const map = page.getByTestId('map-picker');
  await map.click({ position: { x: 150, y: 130 } });
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await expect(page.getByRole('heading', { name: /Your placement:/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Daily leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See final results' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/phase4-daily-result.png', fullPage: true });
});
