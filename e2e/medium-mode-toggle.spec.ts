import { test, expect } from '@playwright/test';
import { chooseDifficulty, testIds } from './support/game';

/**
 * R07 — Medium lets the player switch between map and list; list mode renders
 * the candidates; both surfaces submit a guess.
 */
test.describe('Medium map/list toggle (R07)', () => {
  test('Medium defaults to map and can submit a map guess', async ({ page }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'medium', 'map');
    await page.getByRole('button', { name: /start/i }).click();

    const map = page.getByTestId(testIds.mapPicker);
    await expect(map).toBeVisible();

    await map.click({ position: { x: 240, y: 160 } });
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
  });

  test('Medium toggles to list, shows candidates, and can submit a list guess', async ({ page }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'medium', 'list');
    await page.getByRole('button', { name: /start/i }).click();

    // The mode toggle is visible only for Medium (R05).
    const toggle = page.getByTestId(testIds.modeToggle);
    await expect(toggle).toBeVisible();

    // List mode renders the candidate list; each candidate is selectable.
    const list = page.getByTestId(testIds.candidateList);
    await expect(list).toBeVisible();
    const firstCandidate = page.getByTestId(testIds.candidateItem).first();
    await expect(firstCandidate).toBeVisible();

    await firstCandidate.click();
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
  });
});
