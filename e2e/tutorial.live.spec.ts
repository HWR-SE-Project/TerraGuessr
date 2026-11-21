import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test.beforeEach(() => {
  test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires the running backend and Google Maps.')
})
const guide = (page: Page) => page.getByRole('dialog', { name: 'How to play / Tutorial' })
async function screenshot(page: Page, info: TestInfo, name: string) {
  const directory = process.env.TERRAGUESSR_TUTORIAL_SCREENSHOTS === '1'
    ? resolve('docs/screenshots/tutorial-redesign/after') : info.outputPath('screenshots')
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, `${name}.png`)
  // Capture the actual viewport, including on mobile. Never enlarge the phone for a screenshot.
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}
async function start(page: Page, difficulty = 'medium') {
  await page.goto('/game/singleplayer')
  await page.getByRole('radio', { name: new RegExp(difficulty, 'i') }).click()
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await expect(guide(page)).toBeVisible()
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.gi-condition')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.sp-guess-panel .sp-google-map')).toHaveAttribute('data-tiles-ready', 'true', { timeout: 30_000 })
  // The SDK's ready event precedes painting the high-resolution panorama tiles.
  await page.waitForTimeout(1500)
}
async function checkStep(page: Page, number: number, target: string) {
  await expect(guide(page).getByText(`${number} / 5`)).toBeVisible()
  await expect(page.locator('.tt-coach')).toHaveCount(1)
  await expect(page.locator('.tt-coach')).toHaveAttribute('data-target', target)
  await expect(guide(page).locator('.gi-panel, .sp-google-map, .sp-guess-button')).toHaveCount(0)
  await expect(guide(page).getByRole('button', { name: 'Exit tutorial' })).toBeInViewport()
  await expect(guide(page).getByRole('button', { name: /^(Next|Finish tutorial)$/ })).toBeInViewport()
  await expect.poll(async () => page.evaluate(() => {
    const card = document.querySelector('.tt-coach')!.getBoundingClientRect()
    const ring = document.querySelector('.tt-target-ring')?.getBoundingClientRect()
    return !ring || card.right <= ring.left || card.left >= ring.right || card.bottom <= ring.top || card.top >= ring.bottom
  })).toBe(true)
}

test('R14 live: real targets, preserved pin/panorama, actual submission, distance/points and next round', async ({ page }, info) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await start(page)
  await checkStep(page, 1, 'Weather')
  await expect(page.locator('.gi-panel')).toHaveCount(1)
  await screenshot(page, info, 'desktop-weather')
  await guide(page).getByRole('button', { name: 'Exit tutorial' }).click()
  const map = page.locator('.sp-guess-panel .sp-google-map')
  await map.click({ position: { x: 120, y: 90 } })
  await page.mouse.move(500, 80)
  await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
  const pin = await page.locator('.sp-map-footer > span').innerText()
  const panorama = await page.locator('.sp-panorama').elementHandle()
  const mutations: string[] = []
  const listener = (req: import('@playwright/test').Request) => { if (req.url().includes('/api/singleplayer/') && req.method() !== 'GET') mutations.push(req.url()) }
  page.on('request', listener)
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  for (let number = 1; number <= 5; number++) {
    await checkStep(page, number, ['Weather', 'Location', 'Confirmation', 'example', 'Points'][number - 1]!)
    if (number > 1) await screenshot(page, info, `desktop-${['weather', 'location', 'confirmation', 'distance', 'points'][number - 1]}`)
    if (number === 4) {
      await expect(guide(page).getByLabel('Tutorial example: London to Paris')).toContainText('343.6 km')
    }
    if (number === 5) {
      await guide(page).getByRole('slider').fill('2000')
      await expect(guide(page).getByLabel('Example score')).toContainText('4,522')
    }
    await guide(page).getByRole('button', { name: number === 5 ? 'Finish tutorial' : 'Next', exact: true }).click()
  }
  await expect(guide(page)).toHaveCount(0)
  expect(await panorama!.evaluate(el => el.isConnected)).toBe(true)
  expect(await page.locator('.sp-map-footer > span').innerText()).toBe(pin)
  expect(mutations).toEqual([])
  page.off('request', listener)
  // Verify the real selection, scoring and round transition still work after the tour.
  await page.getByRole('button', { name: 'Guess', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  for (let i = 0; i < 3; i++) await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  await checkStep(page, 4, 'Distance')
  await expect(page.locator('.tt-target-ring')).toBeVisible()
  await screenshot(page, info, 'desktop-real-distance')
  await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
  await checkStep(page, 5, 'Points')
  await screenshot(page, info, 'desktop-real-points')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Next round', exact: true }).click()
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({ timeout: 45_000 })
  await expect(guide(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('R14 live: Easy shortlist and Hard borderless map remain usable after the guide', async ({ page }, info) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.clear())
  for (const difficulty of ['easy', 'hard']) {
    await page.goto('/game/singleplayer')
    await page.getByRole('radio', { name: new RegExp(difficulty, 'i') }).click()
    await page.getByRole('button', { name: /Start exploring/i }).click()
    await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({ timeout: 45_000 })
    await guide(page).getByRole('button', { name: 'Next', exact: true }).click()
    await checkStep(page, 2, 'Location')
    await screenshot(page, info, `desktop-location-${difficulty}`)
    await guide(page).getByRole('button', { name: 'Restart tutorial' }).click()
    await checkStep(page, 1, 'Weather')
    await page.keyboard.press('Escape')
    if (difficulty === 'easy') {
      await page.getByTestId('candidate-option').nth(0).click()
      await page.getByTestId('candidate-option').nth(1).click()
      await expect(page.getByTestId('candidate-option').nth(1)).toHaveAttribute('aria-pressed', 'true')
    } else {
      await expect(page.locator('.gi-panel')).not.toHaveClass(/gi-panel-collapsed/)
      const map = page.locator('.sp-guess-panel .sp-google-map')
      await expect(map).toHaveAttribute('data-tiles-ready', 'true', { timeout: 30_000 })
      await map.click({ position: { x: 130, y: 100 } })
    }
    await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
  }
})

test('R14 live mobile: real touch-screen targets and all five compact cards', async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await start(page)
    await page.setViewportSize({ width: 320, height: 720 })
    await checkStep(page, 1, 'Weather')
    await expect.poll(async () => page.evaluate(() => {
      const panel = document.querySelector('.sp-stage > .gi-panel')!.getBoundingClientRect()
      return ['.gi-temperature', '.gi-metrics', '.gi-precipitation'].every(selector => {
        const rect = document.querySelector(`.sp-stage > .gi-panel ${selector}`)!.getBoundingClientRect()
        return rect.top >= panel.top && rect.bottom <= panel.bottom
      })
    })).toBe(true)
    await screenshot(page, info, 'mobile-small-weather')
    await page.setViewportSize({ width: 390, height: 844 })
    for (let number = 1; number <= 5; number++) {
      await checkStep(page, number, ['Weather', 'Location', 'Confirmation', 'example', 'Points'][number - 1]!)
      await screenshot(page, info, `mobile-${['weather', 'location', 'confirmation', 'distance', 'points'][number - 1]}`)
      await guide(page).getByRole('button', { name: number === 5 ? 'Finish tutorial' : 'Next', exact: true }).tap()
    }
    await expect(guide(page)).toHaveCount(0)
    const map = page.locator('.sp-guess-panel .sp-google-map')
    await map.tap({ position: { x: 140, y: 90 } })
    await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Game menu' }).tap()
    await page.getByRole('button', { name: 'How to Play / Tutorial', exact: true }).tap()
    await checkStep(page, 1, 'Weather')
    await guide(page).getByRole('button', { name: 'Exit tutorial' }).tap()
    await expect(guide(page)).toHaveCount(0)
  } finally { await context.close() }
})
