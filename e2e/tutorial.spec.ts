import { test, expect } from '@playwright/test';

/**
 * R14 — the tutorial explains mechanics, selection, and scoring and is
 * reachable from the app.
 *
 * TODO(frontend): features/tutorial/** is not built yet (W-06, milestone M4).
 * This spec is marked fixme so it is reported (not silently skipped) until the
 * tutorial ships; remove fixme when W-06 lands.
 */
test.describe('tutorial (R14)', () => {
  test.fixme('tutorial is reachable and explains mechanics, selection, and scoring', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /tutorial/i }).click();
    await expect(page.getByRole('heading', { name: /tutorial/i })).toBeVisible();
    await expect(page.getByText(/selection/i)).toBeVisible();
    await expect(page.getByText(/scoring/i)).toBeVisible();
  });
});
