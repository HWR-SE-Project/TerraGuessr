import { expect, test } from '@playwright/test';
import { guessOnMap, registerAndLogin, startSoloGame } from './support/game';

test.describe('solo play', () => {
  test('map mode: guess, change the guess, submit, and reach the summary after all rounds', async ({ page }) => {
    await registerAndLogin(page, 'Map Player');
    await startSoloGame(page, { difficulty: 'easy', mode: 'map', rounds: 3 });

    const submit = page.getByRole('button', { name: 'Submit guess' });
    await expect(submit).toBeDisabled();

    await guessOnMap(page);
    await expect(submit).toBeEnabled();

    // Changing the guess before submitting still leaves exactly one pin and an enabled submit.
    await page.locator('.tg-map-picker').click({ position: { x: 220, y: 90 } });
    await expect(page.locator('.tg-map-pin--guess')).toHaveCount(1);
    await expect(submit).toBeEnabled();

    for (let round = 1; round <= 3; round += 1) {
      await page.getByRole('button', { name: 'Submit guess' }).click();
      await expect(page.locator('.tg-play-result-score-value')).toBeVisible();
      const isLast = round === 3;
      await page.getByRole('button', { name: isLast ? 'View summary' : 'Next round' }).click();
      if (!isLast) await guessOnMap(page);
    }

    await expect(page.getByText('Expedition complete')).toBeVisible();
    await expect(page.locator('.tg-play-summary-row')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  });

  test('list mode: picking a candidate enables submit and a round can be played end to end', async ({ page }) => {
    await registerAndLogin(page, 'List Player');
    await startSoloGame(page, { difficulty: 'hard', mode: 'list', rounds: 3 });

    const submit = page.getByRole('button', { name: 'Submit guess' });
    await expect(submit).toBeDisabled();

    const first = page.getByTestId('candidate-option').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.locator('.tg-play-result-score-value')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next round' })).toBeVisible();
  });

  test('the weather panel shows required clues and expands optional sun/local-time clues', async ({ page }) => {
    await registerAndLogin(page, 'Clue Checker');
    await startSoloGame(page, { difficulty: 'hard', mode: 'map', rounds: 3 });

    const panel = page.getByTestId('weather-panel');
    for (const label of ['Temperature', 'Precipitation', 'Humidity', 'Wind speed']) {
      await expect(panel.getByText(label, { exact: true })).toBeVisible();
    }

    await page.getByText('Sun & local time').click();
    await expect(panel.getByText('UV index', { exact: true })).toBeVisible();
  });
});
