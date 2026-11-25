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
});
