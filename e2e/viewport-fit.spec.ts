import { requestGameExit } from './support/navigation'
import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Use Chromium's current headless mode for the same GPU path as the native
// browser-zoom checks, rather than the legacy headless shell.
test.use({ channel: 'chromium' })

const sizes = [[1920, 1080], [1711, 864], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844]] as const
const output = 'docs/screenshots/viewport'

// CDP uses physical bounds correctly under native browser zoom; Playwright's
// CSS-pixel screenshot clip can crop a zoomed page despite correct DOM bounds.
async function capture(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page)
  try {
    const { contentSize } = await cdp.send('Page.getLayoutMetrics')
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } })
    await writeFile(path, Buffer.from(shot.data, 'base64'))
  } finally { await cdp.detach() }
}

async function metrics(page: Page, desktop: boolean) {
  // Let dynamic viewport units and WebGL ResizeObservers settle after resize.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const result = await page.evaluate(() => {
    const root = document.documentElement
    return { width: innerWidth, height: innerHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight,
      vertical: root.scrollHeight > root.clientHeight, horizontal: root.scrollWidth > root.clientWidth }
  })
  expect(result.horizontal, JSON.stringify(result)).toBe(false)
  if (desktop) expect(result.vertical, JSON.stringify(result)).toBe(false)
  return result
}

// Checking page dimensions alone misses controls hidden inside a clipped card.
// Scroll each required control into view and hit-test it through its ancestors.
async function reachable(page: Page, selector: string, desktop: boolean) {
  expect(await page.locator(selector).count(), selector).toBeGreaterThan(0)
  for (const control of await page.locator(selector).all()) {
    if (!(await control.isVisible())) continue
    if (!desktop) await control.scrollIntoViewIfNeeded()
    expect(await control.evaluate(el => {
      const r = el.getBoundingClientRect()
      if (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1) return false
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !!hit && (el.contains(hit) || hit.contains(el))
    }), await control.getAttribute('class')).toBe(true)
  }
}

async function setup(page: Page) {
  await page.goto('/game/singleplayer')
  await expect(page.locator('.sp-welcome')).toBeVisible()
  await expect(page.getByText('Checking game availability…', { exact: true })).toBeHidden()
  await expect(page.locator('.sp-guess-panel, .sp-hud, .sp-panorama, .sp-stage')).toHaveCount(0)
}

test('primary screens fit desktops and keep mobile controls reachable', async ({ page }) => {
  test.setTimeout(360_000)
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const report: unknown[] = []
  for (const [name, path, controls] of [
    ['home', '/', '.th-edit-avatar, .th-nav-link, .th-tutorial-entry'],
    ['setup', '/game/singleplayer', '.tg-difficulty-option, .sp-welcome .tg-button--primary, .sp-welcome .tg-button--secondary'],
    ['lobby', '/multiplayer', '.tg-difficulty-option, .tl-entry-form .tg-button--primary'],
  ]) {
    if (name === 'setup') await setup(page)
    else await page.goto(path)
    await page.locator(controls).filter({ visible: true }).first().waitFor()
    if (name === 'home') await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => scrollTo(0, 0))
      const desktop = width >= 1024
      report.push({ name, ...await metrics(page, desktop) })
      await reachable(page, controls, desktop)
      if (name === 'setup') expect(await page.locator('.sp-welcome').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true)
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `${output}/${name}-${width}x${height}.png`, fullPage: true })
    }
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit Avatar' }).click()
  await expect(page.locator('.ae-save')).toBeEnabled({ timeout: 30_000 })
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    report.push({ name: 'avatar', ...await metrics(page, width >= 1024) })
    await reachable(page, '.ae-save, .ae-cancel, .ae-icon-button', true)
    expect(await page.locator('.ae-dialog').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    await page.getByRole('button', { name: 'Outfit', exact: true }).click()
    const last = page.locator('.ae-swatch').last()
    await last.scrollIntoViewIfNeeded()
    await reachable(page, '.ae-swatch:last-child', false)
    await page.screenshot({ path: `${output}/avatar-${width}x${height}.png` })
  }
  await page.keyboard.press('Escape')
  await writeFile(`${output}/sizes.json`, JSON.stringify(report, null, 2))
})

test('genuine browser zoom 80–200% keeps primary screens accessible', async ({ baseURL }) => {
  test.setTimeout(300_000)
  await mkdir(output, { recursive: true })
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-viewport-zoom-'))
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL, reducedMotion: 'reduce', args: ['--window-size=1711,864'] })
  const report: unknown[] = []
  try {
    const settings = await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page = await context.newPage()
    for (const zoom of [80, 90, 100, 110, 125, 150, 200]) {
      await settings.locator('#zoomLevel').selectOption({ label: `${zoom}%` })
      for (const [name, path, controls] of [
        ['home', '/', '.th-edit-avatar, .th-nav-link'],
        ['setup', '/game/singleplayer', '.tg-difficulty-option, .sp-welcome .tg-button--primary, .sp-welcome .tg-button--secondary'],
          ]) {
        if (name === 'setup') await setup(page)
        else await page.goto(path)
        await page.locator(controls).filter({ visible: true }).first().waitFor()
        await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom / 100, 1)
        report.push({ name, zoom, ...await metrics(page, zoom <= 100) })
        await reachable(page, controls, zoom <= 100)
        if (zoom === 200) { await page.evaluate(() => scrollTo(0, 0)); await capture(page, `${output}/${name}-zoom-${zoom}.png`) }
        if (name === 'home') {
          await page.getByRole('button', { name: 'Edit Avatar' }).click()
          await expect(page.locator('.ae-save')).toBeEnabled({ timeout: 30_000 })
          await reachable(page, '.ae-save, .ae-cancel, .ae-icon-button', true)
          const body = page.locator('.ae-body')
          expect(await body.evaluate(el => el.clientHeight)).toBeGreaterThan(60)
          if (zoom === 200) {
            await capture(page, `${output}/avatar-zoom-${zoom}.png`)
            await page.getByRole('button', { name: 'Outfit', exact: true }).click()
            await page.locator('.ae-swatch').last().scrollIntoViewIfNeeded()
            await reachable(page, '.ae-swatch:last-child', false)
            await capture(page, `${output}/avatar-options-zoom-${zoom}.png`)
          }
          await page.keyboard.press('Escape')
        }
      }
    }
    await writeFile(`${output}/zoom.json`, JSON.stringify(report, null, 2))
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('live gameplay, round results and summary fit the reference sizes', async ({ page }) => {
  test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires the running backend and live Maps credentials')
  test.setTimeout(180_000)
  await mkdir(output, { recursive: true })
  const report: unknown[] = []
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await expect(page.locator('.sp-panorama')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 })
  await page.getByRole('button', { name: 'Game settings' }).click()
  await page.getByRole('switch', { name: 'Expand map on hover' }).uncheck()
  await page.keyboard.press('Escape')
  for (const phase of ['active', 'round', 'summary']) {
    if (phase === 'round') {
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.locator('.sp-guess-panel .sp-google-map').click({ position: { x: 100, y: 90 } })
      await page.getByRole('button', { name: 'Guess', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
    }
    if (phase === 'summary') {
      await requestGameExit(page)
      await page.getByRole('button', { name: 'End Game', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Final results' })).toBeVisible()
    }
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => scrollTo(0, 0))
      const desktop = width >= 1024
      report.push({ name: phase, ...await metrics(page, desktop) })
      await reachable(page, phase === 'active' ? '.th-icon-btn, .sp-guess-button, .sp-compass, .gi-header' : '.tg-page-actions button', desktop)
      if (phase === 'active') {
        await page.getByRole('button', { name: 'Expand map', exact: true }).click()
        await page.mouse.move(0, 0)
        await metrics(page, desktop)
        await reachable(page, '.sp-guess-button', desktop)
        await page.getByRole('button', { name: 'Shrink map', exact: true }).click()
        await expect(page.locator('.sp-panorama')).toHaveAttribute('data-ready', 'true')
      }
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `${output}/${phase}-${width}x${height}.png`, fullPage: true })
    }
  }
  await writeFile(`${output}/gameplay.json`, JSON.stringify(report, null, 2))
})
