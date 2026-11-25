import { expect, test } from '@playwright/test';

test.describe('singleplayer gameplay', () => {
  test('starts an easy game, completes a round, and advances to round 2', async ({ page }) => {
    await page.goto('/singleplayer');
    await page.getByRole('radio', { name: /Easy/i }).click();
    await page.getByRole('button', { name: 'Start exploring' }).click();

    await expect(page).toHaveURL(/\/singleplayer\/play$/);
    await expect(page.getByText('Pick a city')).toBeVisible({ timeout: 20_000 });

    const candidates = page.locator('button[aria-pressed]');
    await expect(candidates).toHaveCount(6);

    await candidates.first().click();
    await page.getByRole('button', { name: 'Final submit' }).click();

    const resultDialog = page.getByRole('dialog', { name: 'Round 1 result' });
    await expect(resultDialog).toBeVisible();
    await expect(resultDialog.getByText('Total score')).toBeVisible();

    await resultDialog.getByRole('button', { name: 'Next round' }).click();
    await expect(resultDialog).toBeHidden();
    await expect(page.getByText('Pick a city')).toBeVisible({ timeout: 20_000 });
  });

  test('completes a 3-round singleplayer game automatically and shows the final summary', async ({ page }) => {
    await page.goto('/singleplayer');
    await page.getByRole('radio', { name: /Easy/i }).click();
    // Default is 5 rounds; step down twice to 3 rounds (minimum matching multiplayer).
    await page.getByRole('button', { name: 'Fewer rounds' }).click();
    await page.getByRole('button', { name: 'Fewer rounds' }).click();
    await page.getByRole('button', { name: 'Start exploring' }).click();

    await expect(page).toHaveURL(/\/singleplayer\/play$/);

    for (let round = 1; round <= 3; round += 1) {
      await expect(page.getByText('Pick a city')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(`Round ${round}`)).toBeVisible();
      await expect(page.getByText('/ 3')).toBeVisible();

      const candidates = page.locator('button[aria-pressed]');
      await expect(candidates).toHaveCount(6);
      await candidates.first().click();
      await page.getByRole('button', { name: 'Final submit' }).click();

      const resultDialog = page.getByRole('dialog', { name: `Round ${round} result` });
      await expect(resultDialog).toBeVisible();
      if (round < 3) {
        await resultDialog.getByRole('button', { name: 'Next round' }).click();
        await expect(resultDialog).toBeHidden();
      } else {
        await resultDialog.getByRole('button', { name: 'View summary' }).click();
      }
    }

    await expect(page.getByRole('heading', { name: 'Well explored!' })).toBeVisible();
    await expect(page.getByText('You completed all 3 rounds.')).toBeVisible();
    await expect(page.getByText('3 / 3')).toBeVisible();
  });
});
