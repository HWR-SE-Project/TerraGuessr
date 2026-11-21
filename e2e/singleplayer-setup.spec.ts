import { requestGameExit } from './support/navigation'
import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.use({ channel: 'chromium' })
const output = 'docs/screenshots/setup-minimal'
const sizes = [[1920, 1080], [1711, 864], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [701, 864], [390, 844], [375, 812], [320, 568]] as const
const controls = '.tg-difficulty-option, .sp-setup-options > .tg-button--primary, .tg-page-nav a:visible, .tg-page-nav button:visible'

async function ready(page: Page) {
  await page.goto('/game/singleplayer')
  await expect(page.getByRole('radio', { name: /Medium/ })).toBeVisible()
  await expect(page.locator('.cosmic-background')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'setup')
  await expect(page.locator('.sp-guess-panel, .sp-hud, .sp-panorama, .sp-stage')).toHaveCount(0)
}

async function dimensions(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  return page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, pixelRatio: devicePixelRatio }))
}

async function reachable(page: Page, mayScroll: boolean) {
  for (const control of await page.locator(controls).all()) {
    if (mayScroll) await control.scrollIntoViewIfNeeded()
    expect(await control.evaluate(el => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && !!hit && el.contains(hit)
    }), await control.getAttribute('class')).toBe(true)
  }
}

test('setup fits desktops; all difficulty states and mobile controls are clear and reachable', async ({ page }) => {
  test.setTimeout(120_000)
  await mkdir(output, { recursive: true })
  await ready(page)
  const report = []
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => scrollTo(0, 0))
    const metrics = await dimensions(page)
    expect(metrics.scrollWidth).toBe(width)
    if (width >= 1024) expect(metrics.scrollHeight).toBe(height)
    await reachable(page, width < 1024)
    report.push(metrics)
    await page.evaluate(() => scrollTo(0, 0))
    // Allow the animated WebGL environment to settle after its ResizeObserver.
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${output}/after-${width}x${height}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1711, height: 864 })
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const option = page.getByRole('radio', { name: new RegExp(difficulty) })
    await option.click()
    await expect(option).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
    await expect(option.locator('.tg-difficulty-check')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Exploring', exact: true })).toHaveText('Start Exploring')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('terraguessr.difficulty.v1'))).toBe(difficulty.toLowerCase())
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${output}/selected-${difficulty.toLowerCase()}.png` })
  }
  await page.reload()
  await expect(page.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: /Hard/ }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: /Easy/ })).toBeFocused()
  await expect(page.getByRole('radio', { name: /Easy/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: /Medium/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /Start exploring/i })).toBeFocused()
  await requestGameExit(page)
  await expect(page).toHaveURL(/\/$/)
  await writeFile(`${output}/viewport-report.json`, JSON.stringify(report, null, 2))
})

test('native browser zoom preserves setup access at 80–200 percent', async ({ baseURL }) => {
  test.setTimeout(120_000)
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-setup-zoom-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL,
    args: ['--window-size=1711,864'],
  })
  const report = []
  try {
    const settings = await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page = await context.newPage()
    for (const zoom of [80, 100, 125, 150, 200]) {
      await settings.locator('#zoomLevel').selectOption({ label: `${zoom}%` })
      await ready(page)
      await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom / 100, 1)
      const metrics = await dimensions(page)
      expect(metrics.scrollWidth).toBe(metrics.width)
      if (zoom <= 100) expect(metrics.scrollHeight).toBe(metrics.height)
      await reachable(page, zoom > 100)
      report.push({ zoom, ...metrics })
      await page.evaluate(() => scrollTo(0, 0))
      // Capture with CDP's physical coordinates under genuine browser zoom.
      const cdp = await context.newCDPSession(page)
      const { contentSize } = await cdp.send('Page.getLayoutMetrics')
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } })
      await writeFile(`${output}/zoom-${zoom}.png`, Buffer.from(shot.data, 'base64'))
      await cdp.detach()
    }
    await writeFile(`${output}/zoom-report.json`, JSON.stringify(report, null, 2))
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('setup uses shared navigation; unavailable retry and tutorial still work', async ({ page }) => {
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available: false, provider: 'google', serverKeyConfigured: false } }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/game/singleplayer')
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.locator('.sp-topbar')).toHaveCount(0)
  await expect(page.getByText('Street View is currently unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('.sp-guess-panel, .sp-hud, .sp-panorama')).toHaveCount(0)
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByText('Street View is currently unavailable', { exact: true })).toBeVisible()
  await page.goto('/game/singleplayer?tutorial=1')
  await expect(page).toHaveURL('/how-to-play')
  await expect(page.getByRole('heading', { name: 'How to play.' })).toBeVisible()
  await page.getByRole('link', { name: 'Let’s explore' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('link', { name: 'How to play', exact: true }).filter({ visible: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await requestGameExit(page)
  await expect(page).toHaveURL(/\/$/)
})

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`live ${difficulty} setup starts the selected difficulty, plays a round and reaches the summary`, async ({ page }) => {
    test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires the running backend and live Maps credentials')
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1366, height: 768 })
    await ready(page)
    await page.getByRole('radio', { name: new RegExp(difficulty, 'i') }).click()
    const created = page.waitForResponse(response => response.url().endsWith('/api/singleplayer/games') && response.request().method() === 'POST')
    await page.getByRole('button', { name: /Start exploring/i }).click()
    const creation = await created
    expect(creation.ok()).toBe(true)
    expect(creation.request().postDataJSON()).toEqual({ difficulty })
    await expect(page.locator('.sp-panorama')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 })
    await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
    await expect(page.locator('.sp-setup-shell')).toHaveCount(0)
    await page.getByRole('button', { name: 'Game settings' }).click()
    await page.getByRole('switch', { name: 'Expand map on hover' }).uncheck()
    await page.keyboard.press('Escape')
    if (difficulty === 'easy') await page.getByTestId('candidate-option').first().click()
    else await page.locator('.sp-guess-panel .sp-google-map').click({ position: { x: 100, y: 90 } })
    await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Guess', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
    await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'round-results')
    await requestGameExit(page)
    await page.getByRole('button', { name: 'End Game', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Final results' })).toBeVisible()
    await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'session-summary')
    await writeFile(`${output}/live-${difficulty}-report.json`, JSON.stringify({
      difficulty, createStatus: creation.status(), panoramaReady: true,
      roundScored: true, sessionSummary: true,
    }, null, 2))
  })
}
