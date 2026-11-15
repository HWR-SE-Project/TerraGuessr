import { expect, test } from '@playwright/test';

test('email registration, account dashboard, German preference, and safe account deletion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.tg-google-button')).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Display name').fill('Browser Explorer');
  await page.getByLabel('Email address').fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel('Password').fill('secure browser password 2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your next expedition' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'docs/screenshots/phase2-desktop-dashboard.png', fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('de');
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'docs/screenshots/phase2-mobile-settings-de.png', fullPage: true });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);

  await page.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  await expect(page.getByText('Aktuelle tägliche Serie')).toBeVisible();
  await expect(page.getByText('Längste tägliche Serie')).toBeVisible();
  await page.getByRole('button', { name: 'Konto löschen…' }).click();
  await page.getByLabel('Zur Bestätigung DELETE eingeben').fill('DELETE');
  await page.getByLabel('Aktuelles Passwort').fill('secure browser password 2026');
  await page.getByRole('button', { name: 'Dauerhaft löschen' }).click();
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
});
