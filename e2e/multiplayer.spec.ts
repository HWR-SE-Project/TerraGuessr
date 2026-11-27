import { expect, test } from '@playwright/test';

test.describe('multiplayer lobby', () => {
  test('host creates a lobby, a second player joins by code, and the match starts', async ({ page, browser }) => {
    await page.goto('/multiplayer');
    await page.getByLabel('Your name').fill('Host');
    await page.getByRole('radio', { name: /Easy/i }).click();
    await page.getByRole('button', { name: 'Create lobby' }).click();

    await expect(page).toHaveURL(/\/lobby\/[A-Z0-9]{6}$/);
    await expect(page.getByRole('heading', { name: 'Gather your crew' })).toBeVisible();
    const code = new URL(page.url()).pathname.split('/').pop()!;

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      await guestPage.goto('/multiplayer?mode=join');
      await guestPage.getByLabel('Your name').fill('Guest');
      await guestPage.getByLabel('Lobby code').fill(code);
      await guestPage.getByRole('button', { name: 'Join lobby' }).click();

      await expect(guestPage).toHaveURL(new RegExp(`/lobby/${code}$`));
      await expect(guestPage.getByText('2 / 16')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('2 / 16')).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: 'Start match' }).click();
      await expect(page).toHaveURL(new RegExp(`/lobby/${code}/play$`));
      await expect(guestPage).toHaveURL(new RegExp(`/lobby/${code}/play$`), { timeout: 10_000 });

      await expect(page.getByText('Pick a city')).toBeVisible({ timeout: 20_000 });
      await expect(guestPage.getByText('Pick a city')).toBeVisible({ timeout: 20_000 });
    } finally {
      await guestContext.close();
    }
  });
});
