import { test, expect } from '@playwright/test';
import { chooseDifficulty, testIds } from './support/game';

/**
 * R08 — the guess is editable client-side right up until the final submit.
 * Exercises both selection surfaces explicitly changing the pick before
 * submitting, not just picking once.
 */
test.describe('guess can be changed before final submit (R08)', () => {
  test('list mode: picking a second candidate replaces the first (aria-pressed moves)', async ({
    page,
  }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'easy');
    await page.getByRole('button', { name: /start/i }).click();

    const candidates = page.getByTestId(testIds.candidateItem);
    await expect(candidates.first()).toBeVisible();

    const first = candidates.nth(0);
    const second = candidates.nth(1);

    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');

    // Change the guess to a different candidate before submitting.
    await second.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(second).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
  });

  test('map mode: a second click moves the pin before submitting', async ({ page }) => {
    await page.goto('/');
    await chooseDifficulty(page, 'hard');
    await page.getByRole('button', { name: /start/i }).click();

    const map = page.getByTestId(testIds.mapPicker);
    await expect(map).toBeVisible();

    await map.click({ position: { x: 150, y: 120 } });
    const marker = map.locator('.leaflet-marker-icon');
    await expect(marker).toHaveCount(1);
    const markerAfterFirst = await marker.getAttribute('style');

    // Change the guess to a different point before submitting.
    await map.click({ position: { x: 320, y: 220 } });
    const markerAfterSecond = await marker.getAttribute('style');
    expect(markerAfterSecond).not.toBe(markerAfterFirst);

    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
  });
});
