import { test, expect } from '@playwright/test';
import { chooseDifficulty, expectWeatherPanel, testIds } from './support/game';

/**
 * R01/R06/R08/R09/R10/R11/R15 — play a solo round end to end.
 *
 * Assumes the frontend has composed DifficultyPicker + a start control +
 * RoundScreen (WeatherPanel + MapPicker/CandidateList + submit + RevealView)
 * into the app shell. Those feature components exist (see
 * frontend/src/features/**); this spec drives them via their stable testids.
 */
test.describe('solo round (R01/R06/R08/R09/R10/R11/R15)', () => {
  test('plays a round: 4 weather fields -> map guess -> submit -> reveal', async ({ page }) => {
    await page.goto('/');

    // Hard is map-only, which is the map-guess surface this spec covers.
    await chooseDifficulty(page, 'hard');
    await page.getByRole('button', { name: /start/i }).click();

    // R15: exactly the four weather fields in the consistent layout.
    await expectWeatherPanel(page);

    // R07 map mode: click the Leaflet map to drop the guess marker.
    const map = page.getByTestId(testIds.mapPicker);
    await expect(map).toBeVisible();
    await map.click({ position: { x: 240, y: 160 } });

    // R08: one final submit.
    await page.getByRole('button', { name: 'Submit guess' }).click();

    // R11: reveal distance + score + actual location.
    await expect(page.getByTestId(testIds.revealView)).toBeVisible();
    await expect(page.getByTestId(testIds.revealScore)).toContainText('Score:');
    await expect(page.getByTestId(testIds.revealDistance)).toContainText('Distance:');
    await expect(page.getByTestId(testIds.revealActual)).toContainText('Actual location:');
  });
});
