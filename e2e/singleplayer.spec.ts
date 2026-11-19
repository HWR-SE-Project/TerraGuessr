import { expect, test } from '@playwright/test'

test.describe('Street View singleplayer without credentials', () => {
  test('honest unavailable state, disabled guessing, map expansion, collapse, and home navigation', async ({
    page,
  }) => {
    await page.goto('/game/singleplayer')
    await expect(
      page.getByRole('main', { name: 'TerraGuessr singleplayer game' }),
    ).toBeVisible()
    await expect(
      page.getByText('Street View is currently unavailable', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Guess', exact: true }),
    ).toBeDisabled()
    await expect(
      page.locator('script[src*="maps.googleapis.com"]'),
    ).toHaveCount(0)
    const map = page.getByRole('complementary', { name: 'Guessing map' })
    await page.getByRole('button', { name: 'Expand map', exact: true }).click()
    await page.mouse.move(400, 90)
    await expect(map).toHaveClass(/sp-guess-expanded/)
    await page.getByRole('button', { name: 'Shrink map', exact: true }).click()
    await page.mouse.move(400, 90)
    await expect(map).not.toHaveClass(/sp-guess-expanded/)
    await page.getByRole('button', { name: 'World Explorer' }).click()
    await expect(page.locator('#guess-map-content')).toBeHidden()
    await page.getByRole('button', { name: 'World Explorer' }).click()
    await expect(page.locator('#guess-map-content')).toBeVisible()
    await page.getByRole('button', { name: 'Return', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole('heading', { name: 'Explore the World' }),
    ).toBeVisible()
  })
  test('settings persist, dialogs support Escape and restore focus, and the menu resumes', async ({
    page,
  }) => {
    await page.goto('/game/singleplayer')
    const settings = page.getByRole('button', { name: 'Game settings' })
    await settings.click()
    await page.getByRole('switch', { name: 'Expand map on hover' }).uncheck()
    await page.getByRole('switch', { name: 'Show compass' }).uncheck()
    await page.getByRole('slider', { name: 'Map opacity' }).fill('75')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(settings).toBeFocused()
    await page.reload()
    await settings.click()
    await expect(
      page.getByRole('switch', { name: 'Expand map on hover' }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('switch', { name: 'Show compass' }),
    ).not.toBeChecked()
    await expect(page.getByRole('slider', { name: 'Map opacity' })).toHaveValue(
      '75',
    )
    await page.getByRole('button', { name: 'Back to exploring' }).click()
    await page.getByRole('button', { name: 'Game menu' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Take a breather' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Restart game' }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Resume game' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
  test('touch map expands within the viewport and all corner controls remain reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/game/singleplayer')
    await page.getByRole('button', { name: 'Expand map', exact: true }).click()
    const map = page.getByRole('complementary', { name: 'Guessing map' })
    await expect(map).toHaveClass(/sp-guess-expanded/)
    const bounds = await map.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Game menu' }).click()
    await page.getByRole('button', { name: 'Resume game' }).click()
    await page.getByRole('button', { name: 'Shrink map', exact: true }).click()
    await page.mouse.move(1, 1)
    for (const width of [320, 390, 701, 768, 1024, 1280, 1792]) {
      await page.setViewportSize({ width, height: 844 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width)
      const overlaps = () =>
        page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect()
          const intersects = (a: DOMRect, b: DOMRect) =>
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          const hud = rect('.sp-hud')
          return {
            returnHud: intersects(rect('.sp-return'), hud),
            mapHud: intersects(rect('.sp-guess-panel'), hud),
          }
        })
      await expect.poll(overlaps).toEqual({ returnHud: false, mapHud: false })
      await expect(
        page.getByRole('button', { name: 'Game settings' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Return', exact: true }),
      ).toBeVisible()
    }
  })
})
