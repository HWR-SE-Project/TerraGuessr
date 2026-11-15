import { test, expect } from '@playwright/test';
import { chooseDifficulty, testIds } from './support/game';

/**
 * R05 — Easy is list-only, Hard is map-only; only Medium offers the toggle.
 */
test.describe('difficulty selection modes (R05)', () => {
  test('Easy is list-only and renders the candidate list', async ({ page }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'easy');

    // No map/list toggle for Easy; the locked hint confirms list-only.
    await expect(page.getByTestId(testIds.modeToggle)).toHaveCount(0);
    await expect(page.getByTestId(testIds.selectionLocked)).toContainText(/list/i);

    await page.getByRole('button', { name: /start/i }).click();
    await expect(page.getByTestId(testIds.candidateList)).toBeVisible();
    await expect(page.getByTestId(testIds.mapPicker)).toHaveCount(0);
  });

  test('Hard is map-only and renders the map picker', async ({ page }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'hard');

    await expect(page.getByTestId(testIds.modeToggle)).toHaveCount(0);
    await expect(page.getByTestId(testIds.selectionLocked)).toContainText(/map/i);

    await page.getByRole('button', { name: /start/i }).click();
    await expect(page.getByTestId(testIds.mapPicker)).toBeVisible();
    await expect(page.getByTestId(testIds.candidateList)).toHaveCount(0);
  });
});
