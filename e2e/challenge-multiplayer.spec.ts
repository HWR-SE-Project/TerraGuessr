import { expect, test } from '@playwright/test';
import { registerAndLogin } from './support/game';

/**
 * Two genuinely independent browser contexts (no shared cookies/localStorage)
 * play the same async duel location via the Duels page and both end up on the
 * same public challenge leaderboard under their own names.
 */
test('two independent browsers duel the same location and both appear on the leaderboard', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  try {
    await registerAndLogin(pageA, 'Alice Duelist');
    await pageA.goto('/duels');
    await pageA.getByRole('button', { name: 'Play' }).click();

    await expect(pageA.getByText('Where is this?')).toBeVisible();
    await pageA.locator('.tg-duel-overlay-map .tg-map-picker').click({ position: { x: 150, y: 130 } });
    await pageA.getByRole('button', { name: 'Lock in guess & create duel link' }).click();

    await expect(pageA.getByText('Beat this location')).toBeVisible({ timeout: 15000 });
    await expect(pageA.getByText(/challenge created/i)).toBeVisible();
    const challengePath = new URL(pageA.url()).pathname;

    await pageA.getByLabel('Name on the leaderboard (optional)').fill('Alice Duelist');
    await pageA.getByRole('button', { name: 'Add to leaderboard' }).click();
    await expect(pageA.getByText("You're on the leaderboard below.")).toBeVisible();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      await pageB.goto(challengePath);
      await expect(pageB.getByText('Beat this location')).toBeVisible();
      await pageB.getByRole('button', { name: 'Play this challenge' }).click();

      await expect(pageB.getByTestId('weather-panel')).toBeVisible();
      await pageB.getByTestId('candidate-option').first().click();
      await pageB.getByRole('button', { name: 'Submit guess' }).click();

      await expect(pageB.locator('.tg-challenge-result-score')).toBeVisible();
      await pageB.getByLabel('Name on the leaderboard (optional)').fill('Bob Duelist');
      await pageB.getByRole('button', { name: 'Add to leaderboard' }).click();

      const rows = pageB.locator('.tg-challenge-leaderboard-list li');
      await expect(rows).toHaveCount(2);
      const text = await rows.allTextContents();
      expect(text.some((row) => row.includes('Alice Duelist'))).toBe(true);
      expect(text.some((row) => row.includes('Bob Duelist'))).toBe(true);

      // A revisit after already playing shows the "already played" note, not a second playable round.
      await pageB.reload();
      await expect(pageB.getByText("You've already played this challenge")).toBeVisible();
    } finally {
      await contextB.close();
    }
  } finally {
    await contextA.close();
  }
});

test('an invalid challenge link shows an honest error instead of a broken page', async ({ page }) => {
  await page.goto('/challenge/this-challenge-does-not-exist');
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});
