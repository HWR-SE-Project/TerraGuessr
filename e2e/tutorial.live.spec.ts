import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

// Opt-in real backend + Google Maps + Street View. No route interception or provider doubles.
test.beforeEach(() => {
  test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires configured Google Maps and the running backend.')
})
const guide = (page: Page) => page.getByRole('dialog', { name: 'How to play / Tutorial' })
async function screenshot(page: Page, info: TestInfo, name: string) {
  const directory = process.env.TERRAGUESSR_TUTORIAL_SCREENSHOTS === '1'
    ? resolve('docs/screenshots/tutorial') : info.outputPath('screenshots')
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, `${name}.png`)
  const viewport = page.viewportSize()
  if (viewport && viewport.width < 760 && await guide(page).isVisible()) {
    const height = await guide(page).locator('.tt-scroll').evaluate(element => element.scrollHeight)
    await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) })
    await page.screenshot({ path, fullPage: true })
    await page.setViewportSize(viewport)
  } else await page.screenshot({ path, fullPage: true })
  await info.attach(name, { path, contentType: 'image/png' })
}

test('R14 live: five contextual sections, safe confirmation, preserved actual game and menu entries', async ({ page }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'How to Play / Tutorial' })).toBeVisible()
  // Wait for the existing home scene before the deliverable screenshot.
  await expect(page.locator('.th-character-slot')).not.toHaveAttribute('data-character-status', 'loading', { timeout: 30_000 })
  await screenshot(page, info, '00-main-menu')
  await page.getByRole('link', { name: 'Play Solo Challenge yourself' }).click()
  await page.getByRole('radio', { name: /Medium/ }).click()
  await page.getByRole('button', { name: /Start exploring/ }).click()
  await expect(guide(page)).toBeVisible() // temporary always-show
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({ timeout: 45_000 })
  await expect(guide(page).getByText('Current round · model weather clues')).toBeVisible({ timeout: 30_000 })
  await guide(page).getByRole('button', { name: 'Skip' }).click()
  const gameMap = page.locator('.sp-guess-panel .sp-google-map')
  await expect(gameMap.locator('img').first()).toBeVisible({ timeout: 20_000 })
  await gameMap.click({ position: { x: 150, y: 120 } })
  await page.mouse.move(400, 80)
  await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
  const panorama = await page.locator('.sp-panorama').elementHandle()
  const mutations: string[] = []
  page.on('request', request => { if (request.url().includes('/api/singleplayer/') && request.method() !== 'GET') mutations.push(request.url()) })
  await page.getByRole('button', { name: 'Game menu' }).click()
  await screenshot(page, info, '00-game-menu')
  await page.getByRole('button', { name: 'How to Play / Tutorial' }).click()
  await expect(guide(page).getByText('Current round · model weather clues')).toBeVisible()
  await screenshot(page, info, '01-weather')
  await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  const practiceMap = guide(page).locator('.sp-google-map')
  await expect(practiceMap.locator('img').first()).toBeVisible({ timeout: 20_000 })
  await expect(practiceMap).toHaveAttribute('data-tiles-ready', 'true', { timeout: 20_000 })
  await practiceMap.click({ position: { x: 190, y: 120 } })
  await expect(guide(page).getByRole('status')).toContainText('Selected. Not submitted.')
  // Google treats rapid successive clicks as a double-click zoom gesture.
  await page.waitForTimeout(500)
  await practiceMap.click({ position: { x: 310, y: 200 } })
  await expect(guide(page).getByRole('status')).toContainText('Selection changed. Still not submitted.')
  await screenshot(page, info, '02-location-medium')
  await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  await guide(page).getByRole('button', { name: 'Confirm practice guess' }).click()
  await expect(guide(page).getByRole('status')).toContainText('answer is locked')
  await screenshot(page, info, '03-confirmation')
  await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(guide(page).locator('.sp-google-map img').first()).toBeVisible({ timeout: 20_000 })
  await expect(guide(page).locator('.sp-google-map')).toHaveAttribute('data-tiles-ready', 'true', { timeout: 20_000 })
  await expect(guide(page).locator('.tt-distance')).toContainText('343.6 km')
  await screenshot(page, info, '04-distance')
  await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  await guide(page).getByRole('slider').fill('2000')
  await expect(guide(page).getByLabel('Example score')).toContainText('1,839')
  await screenshot(page, info, '05-points')
  await guide(page).getByRole('button', { name: 'Finish tutorial' }).click()
  await expect(guide(page)).toHaveCount(0)
  expect(await panorama!.evaluate(element => element.isConnected)).toBe(true)
  expect(mutations).toEqual([])
  await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
})

test('R14 live: Easy list and borderless Hard map examples before starting a session', async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const difficulty of ['easy', 'hard']) {
    await page.addInitScript(difficulty => localStorage.setItem('terraguessr.difficulty.v1', difficulty), difficulty)
    await page.goto('/game/singleplayer?tutorial=1')
    await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
    if (difficulty === 'easy') {
      await expect(guide(page).getByTestId('candidate-option')).toHaveCount(4)
      await guide(page).getByTestId('candidate-option').nth(0).click()
      await guide(page).getByTestId('candidate-option').nth(2).click()
    } else {
      await expect(guide(page).locator('.sp-google-map img').first()).toBeVisible({ timeout: 20_000 })
      await expect(guide(page).locator('.sp-google-map')).toHaveAttribute('data-tiles-ready', 'true', { timeout: 20_000 })
      await guide(page).locator('.sp-google-map').click({ position: { x: 200, y: 140 } })
    }
    await screenshot(page, info, `02-location-${difficulty}`)
    await guide(page).getByRole('button', { name: 'Skip' }).click()
  }
})

test('R14 live mobile: touch practice and scrollable guidance', async ({ browser, baseURL }, info) => {
  test.setTimeout(60_000)
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto('/game/singleplayer?tutorial=1')
    await expect(guide(page).getByText('Tutorial example · weather, not your current round')).toBeVisible()
    // Capture the full scrollable guide, not a clipped viewport of its first section.
    await guide(page).locator('.tt-scroll').screenshot({ path: info.outputPath('mobile-weather-viewport.png') })
    await screenshot(page, info, '06-mobile-weather')
    await guide(page).getByRole('button', { name: 'Next', exact: true }).tap()
    await expect(guide(page).locator('.sp-google-map img').first()).toBeVisible({ timeout: 20_000 })
    await expect(guide(page).locator('.sp-google-map')).toHaveAttribute('data-tiles-ready', 'true', { timeout: 20_000 })
    await guide(page).locator('.sp-google-map').tap({ position: { x: 140, y: 110 } })
    await expect(guide(page).getByRole('status')).toContainText('Selected. Not submitted.')
    await screenshot(page, info, '06-mobile-location')
    await guide(page).getByRole('button', { name: 'Skip' }).tap()
    await expect(guide(page)).toHaveCount(0)
  } finally { await context.close() }
})
