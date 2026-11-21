import { expect, test } from '@playwright/test';

test.describe('navigation', () => {
  test('signed-out visitors can explore the home page and adjust preferences while account settings stay gated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Singleplayer', exact: true })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByLabel('Language')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
    await expect(page.getByText(/sign in to manage your account/i)).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'TerraGuessr home' })).toBeVisible();
    expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
    await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toHaveCount(0);
  });

  test('primary navigation links and the shared home link navigate while settings remains available', async ({ page }) => {
    await page.route('**/api/auth/session', route => route.fulfill({ json: {
      user: { id: 'nav-tester', displayName: 'Nav Tester', email: 'nav@example.test' },
    } }));
    await page.goto('/');

    await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Create a Lobby', exact: true }).click();
    await expect(page).toHaveURL(/\/multiplayer\/create$/);
    await expect(page.getByRole('heading', { name: 'Create a lobby' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Join a lobby' })).toHaveCount(0);

    await page.goto('/');
    await page.getByRole('link', { name: 'Singleplayer', exact: true }).click();
    await expect(page.getByRole('main', { name: 'TerraGuessr singleplayer game' })).toBeVisible();
    await expect(page).toHaveURL(/\/game\/singleplayer$/);

    await page.goto('/');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
