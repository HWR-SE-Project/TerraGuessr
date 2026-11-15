import { test, expect } from '@playwright/test';

/**
 * R14 — the tutorial explains mechanics, selection, and scoring and is
 * reachable from the app (the "How to play" button on the home screen,
 * see App.tsx / features/tutorial/Tutorial.tsx).
 */
test.describe('tutorial (R14)', () => {
  test('tutorial is reachable and explains mechanics, selection, and scoring', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('how-to-play').click();

    const dialog = page.getByTestId('tutorial-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'How to play' })).toBeVisible();

    await expect(page.getByTestId('tutorial-mechanics')).toBeVisible();
    await expect(page.getByTestId('tutorial-selection-modes')).toContainText(/map/i);
    await expect(page.getByTestId('tutorial-selection-modes')).toContainText(/list/i);
    await expect(page.getByTestId('tutorial-scoring')).toContainText(/scoring/i);

    // Escape closes the dialog (accessible modal behavior).
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
