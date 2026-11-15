import { expect, test } from '@playwright/test';

test('custom solo setup controls a server-enforced one-round game', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Display name').fill('Rules Tester');
  await page.getByLabel('Email address').fill(`rules-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('secure browser password 2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your next expedition' })).toBeVisible();
  await page.getByRole('button', { name: 'Create solo game' }).click();
  await expect(page.getByRole('heading', { name: 'Game setup' })).toBeVisible();
  await page.getByLabel('Number of rounds').focus();
  await page.getByLabel('Number of rounds').press('Home');
  await expect(page.locator('output[for="round-count"]')).toHaveText('1');
  await page.getByLabel('Area').selectOption('ASIA');
  await page.getByLabel('Customize answer choices').check();
  await page.getByLabel('Number of choices').selectOption('3');
  await page.screenshot({ path: 'docs/screenshots/phase3-mobile-setup.png', fullPage: true });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);

  await page.getByRole('button', { name: 'Start solo game' }).click();
  await expect(page.getByText('/ 1', { exact: true })).toBeVisible();
  await expect(page.getByTestId('candidate-name')).toHaveCount(3);
  await page.getByTestId('candidate-name').first().click();
  await page.getByRole('button', { name: /Submit guess/ }).click();
  await page.getByRole('button', { name: 'See final results' }).click();
  await expect(page.getByTestId('results-view')).toBeVisible();
  await expect(page.getByTestId('result-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'See final results' })).toHaveCount(0);
});
