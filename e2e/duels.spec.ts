import { expect, test } from '@playwright/test'
import { registerAndLogin } from './support/game'

test('duels uses authenticated identity and clearly labels the unsupported ranked ladder', async ({ page }) => {
  await registerAndLogin(page, 'Duel Explorer')
  await page.goto('/duels')
  await expect(page.getByRole('main').getByText('Duel Explorer', { exact: true })).toBeVisible()
  await expect(page.getByRole('complementary').getByText('Duel Explorer', { exact: true })).toBeVisible()
  await expect(page.getByText('Unknown player', { exact: true })).toBeVisible()
  await expect(page.getByText('Ladder preview · Ranked play coming soon')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Ranked ladder design demonstration' }).getByRole('listitem')).toHaveCount(5)
})

test('placement controls explain availability without creating a game or inventing progression', async ({ page }) => {
  const gameRequests: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/games')) gameRequests.push(request.url())
  })
  await page.goto('/duels')
  const secondDuel = page.getByRole('button', { name: 'Duel 2', exact: true })
  await secondDuel.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toContainText('Ranked placement duels are not available yet')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(secondDuel).toBeFocused()
  await expect(page.locator('.td-duel-step-active')).toHaveText('Duel 1')
  expect(gameRequests).toEqual([])
})

test('a duel start failure is recoverable and restores keyboard focus', async ({ page }) => {
  await page.route('**/api/games', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Duels temporarily unavailable' } }) }))
  await page.goto('/duels')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled()
  await play.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(play).toBeFocused()
  await expect(play).toBeEnabled()
})

test('duels stays usable without horizontal scrolling across phone, tablet and desktop sizes', async ({ page }) => {
  await page.goto('/duels')
  for (const width of [320, 360, 390, 600, 768, 1024, 1100, 1280, 1440, 1792, 2100]) {
    await page.setViewportSize({ width, height: 861 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await expect(page.getByRole('heading', { name: 'Duels', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'TerraGuessr home', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Multiplayer', exact: true, includeHidden: true })).toHaveAttribute('aria-current', 'page')
    const play = await page.getByRole('button', { name: 'Play', exact: true }).boundingBox()
    expect(play!.width).toBeGreaterThan(150)
    expect(play!.height).toBeGreaterThanOrEqual(44)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'TerraGuessr home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible()
})
