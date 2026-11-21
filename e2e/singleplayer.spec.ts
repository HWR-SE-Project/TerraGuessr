import { requestGameExit } from './support/navigation'
import { expect, test } from '@playwright/test'

test.describe('Street View singleplayer without credentials', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available: false, provider: 'google', serverKeyConfigured: false } }))
  })
  test('honest unavailable state, no premature gameplay UI, and home navigation', async ({
    page,
  }) => {
    await page.goto('/game/singleplayer')
    const main = page.getByRole('main', { name: 'TerraGuessr singleplayer game' })
    await expect(main).toBeVisible()
    await expect(main).toHaveAttribute('data-view', 'setup')
    await expect(
      page.getByText('Street View is currently unavailable', { exact: true }),
    ).toBeVisible()
    // Setup is the only foreground content: no guess map and no round/score
    // HUD exist until an expedition has actually started (R-UI setup state).
    await expect(page.locator('.sp-guess-panel')).toHaveCount(0)
    await expect(page.locator('.sp-hud')).toHaveCount(0)
    await expect(
      page.locator('script[src*="maps.googleapis.com"]'),
    ).toHaveCount(0)
    await requestGameExit(page)
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole('heading', { name: 'Explore the World' }),
    ).toBeVisible()
  })
  test('setup shares site navigation and its mobile menu supports Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/game/singleplayer')
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    const menu = page.getByRole('button', { name: 'Open navigation' })
    await menu.click()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
  test('setup screen stays uncut and its controls remain reachable across viewports', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/game/singleplayer')
    for (const [width, height] of [
      [320, 844],
      [390, 844],
      [701, 864],
      [768, 1024],
      [1024, 768],
      [1366, 768],
      [1792, 1080],
    ] as const) {
      await page.setViewportSize({ width, height })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width)
      // Setup never reserves a guess-map column: no gameplay-only UI exists
      // yet, and the welcome card + its primary action must stay on screen.
      await expect(page.locator('.sp-guess-panel')).toHaveCount(0)
      await expect(page.locator('.sp-hud')).toHaveCount(0)
      await expect(page.locator('.sp-welcome')).toBeInViewport()
      await expect(
        page.getByRole('link', { name: 'TerraGuessr home', exact: true }),
      ).toBeInViewport()
      await expect(
        page.getByRole('link', { name: 'TerraGuessr home', exact: true }),
      ).toBeInViewport()
      const start = page.locator('.sp-welcome .tg-button--primary, .sp-welcome .tg-button--secondary').first()
      await start.scrollIntoViewIfNeeded()
      await expect(start).toBeInViewport()
    }
  })
})
