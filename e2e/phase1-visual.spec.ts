import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const evidence = 'docs/screenshots';

test.beforeEach(async ({ page }) => {
  // Offline API fallback remains a supported developer path and provides a
  // deterministic real UI without requiring credentials or a Docker stack.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).pathname.startsWith('/api/') ? route.abort() : route.continue(),
  );
});

test('desktop landing and easy round', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /read the sky/i })).toBeVisible();
  await page.screenshot({ path: `${evidence}/phase1-desktop-home.png`, fullPage: true });

  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('candidate-list')).toBeVisible();
  const labels = await page.getByTestId('candidate-name').allTextContents();
  expect(new Set(labels).size).toBe(labels.length);
  await page.screenshot({ path: `${evidence}/phase1-desktop-game.png`, fullPage: true });
  await expect(page.getByLabel('Latitude')).toHaveCount(0);
  await expect(page.getByLabel('Longitude')).toHaveCount(0);
});

test('mobile landing and game fit the viewport', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /read the sky/i })).toBeVisible();
  await page.screenshot({ path: `${evidence}/phase1-mobile-home.png`, fullPage: true });

  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('candidate-list')).toBeVisible();
  await page.screenshot({ path: `${evidence}/phase1-mobile-game.png`, fullPage: true });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByLabel('Latitude')).toHaveCount(0);
  await expect(page.getByLabel('Longitude')).toHaveCount(0);
});

test('map mode confirms guesses from the map without coordinate form fields', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByTestId('difficulty-hard').check();
  await page.getByTestId('start-game').click();
  const map = page.getByTestId('map-picker');
  await expect(map).toBeVisible();
  const submit = page.getByRole('button', { name: 'Submit guess' });
  await expect(submit).toBeDisabled();
  await map.click({ position: { x: 180, y: 140 } });
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel('Latitude')).toHaveCount(0);
  await expect(page.getByLabel('Longitude')).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/phase1-desktop-map.png`, fullPage: true });
});
