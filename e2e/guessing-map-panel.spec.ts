import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.use({ channel: 'chromium' })
test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires live Google Maps and the local backend')
const output = 'docs/screenshots/guessing-map-redesign'

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem('terraguessr.gameplay.settings', JSON.stringify({
    hoverExpand: false, compass: true, scrollZoom: true, mapOpacity: 94,
  })))
  await page.goto('/game/singleplayer')
  await page.getByRole('radio', { name: /Medium/ }).click()
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await expect(page.locator('.sp-panorama')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 })
  await expect(page.locator('.sp-world-panel .sp-google-map')).toHaveAttribute('data-tiles-ready', 'true', { timeout: 20_000 })
  await page.waitForTimeout(1000) // SDK readiness precedes imagery painting.
}

async function inspect(page: Page) {
  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON()
    const panel = rect('.sp-world-panel'), map = rect('.sp-world-panel .sp-map-wrap')
    const hint = rect('.sp-map-status'), panorama = rect('.sp-panorama')
    const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const conflicts = ['.tg-page-nav', '.sp-compass', '.sp-hud', '.gi-panel']
      .filter(selector => {
        const el = document.querySelector(selector)
        const r = el?.getBoundingClientRect()
        return r && r.width > 0 && r.height > 0 && intersects(panel, r)
      })
    const coveredStreetViewControls = [...document.querySelectorAll('.sp-panorama button, .sp-panorama a')]
      .filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && intersects(panel, r)
      }).map(el => el.getAttribute('aria-label') || el.textContent)
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight, dpr: devicePixelRatio,
      panel, map, hint, panorama, conflicts, coveredStreetViewControls }
  })
  expect(metrics.scrollWidth).toBe(metrics.width)
  expect(metrics.conflicts).toEqual([])
  expect(metrics.coveredStreetViewControls).toEqual([])
  expect(metrics.hint.top).toBeGreaterThanOrEqual(metrics.map.bottom)
  if (metrics.width <= 1000) expect(metrics.panel.top).toBeGreaterThanOrEqual(metrics.panorama.bottom)
  for (const control of [
    page.locator('.sp-world-panel').getByRole('button', { name: 'Zoom in', exact: true }),
    page.locator('.sp-world-panel').getByRole('button', { name: 'Zoom out', exact: true }),
    page.locator('.sp-world-panel').getByRole('link', { name: /^Terms/ }),
    page.getByRole('button', { name: 'Guess', exact: true }),
  ]) {
    await control.scrollIntoViewIfNeeded()
    await expect(control).toBeInViewport()
    expect(await control.evaluate(el => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !!hit && el.contains(hit)
    })).toBe(true)
  }
  return metrics
}

async function finalizeIfNeeded(page: Page, body: { finalized: boolean }) {
  expect(typeof body.finalized).toBe('boolean')
  if (!body.finalized) {
    const final = page.getByRole('button', { name: 'Final submit', exact: true })
    await expect(final).toBeEnabled()
    await inspect(page)
    await page.screenshot({ path: `${output}/remaining-attempt.png`, fullPage: true })
    const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
    await final.click()
    const scored = await response
    expect(scored.ok()).toBe(true)
    expect(scored.request().postDataJSON().final).toBe(true)
    expect((await scored.json()).finalized).toBe(true)
  }
  await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
}

test('live map: pin, zoom, resize, collapse, responsive layout, and real guess submission', async ({ page }) => {
  test.setTimeout(120_000)
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  const panel = page.locator('.sp-world-panel')
  const map = panel.locator('.sp-google-map')
  const mapNode = await map.elementHandle()
  const guess = page.getByRole('button', { name: 'Guess', exact: true })
  await expect(guess).toBeDisabled()
  await page.screenshot({ path: `${output}/desktop-disabled.png` })
  await panel.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(guess).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeEnabled()
  await panel.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await map.click({ position: { x: 170, y: 100 } })
  await expect(guess).toBeEnabled()
  const marker = map.getByRole('img', { name: 'Your guess. Drag to move.', exact: true })
  await expect(marker).toBeVisible()
  const initialPin = await page.locator('.sp-map-status').innerText()
  const point = (await marker.boundingBox())!
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x + point.width / 2 + 25, point.y + point.height / 2 + 15, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.sp-map-status')).not.toHaveText(initialPin)
  const pin = await page.locator('.sp-map-status').innerText()
  await panel.getByRole('button', { name: 'World Explorer', exact: true }).click()
  await expect(page.locator('#guess-map-content')).toBeHidden()
  await page.screenshot({ path: `${output}/collapsed.png` })
  await panel.getByRole('button', { name: 'World Explorer', exact: true }).click()
  await expect(page.locator('.sp-map-status')).toHaveText(pin)
  await page.getByRole('button', { name: 'Expand map', exact: true }).click()
  await inspect(page)
  await page.screenshot({ path: `${output}/desktop-expanded.png` })
  await page.getByRole('button', { name: 'Shrink map', exact: true }).click()
  const report = []
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(200)
    report.push(await inspect(page))
    expect(await mapNode!.evaluate(el => el.isConnected)).toBe(true)
    await expect(page.locator('.sp-map-status')).toHaveText(pin)
    await expect(guess).toBeEnabled()
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${output}/after-${width}x${height}.png`, fullPage: true })
    if (width === 1440) await panel.screenshot({ path: `${output}/panel-active.png` })
    if (width === 390) {
      await page.getByRole('button', { name: 'Expand map', exact: true }).click()
      await inspect(page)
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `${output}/mobile-expanded.png`, fullPage: true })
      await page.getByRole('button', { name: 'Shrink map', exact: true }).click()
    }
  }
  await writeFile(`${output}/viewport-report.json`, JSON.stringify(report, null, 2) + '\n')
  await page.setViewportSize({ width: 1440, height: 900 })
  const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
  await guess.click()
  const scored = await response
  expect(scored.ok()).toBe(true)
  const submitted = scored.request().postDataJSON()
  expect(submitted.final).toBe(false)
  expect(pin).toContain(`${submitted.lat.toFixed(3)}°, ${submitted.lon.toFixed(3)}°`)
  await finalizeIfNeeded(page, await scored.json())
  await page.screenshot({ path: `${output}/submitted.png` })
  await writeFile(`${output}/submitted.json`, JSON.stringify({ submitted, response: await scored.json() }, null, 2) + '\n')
})

test('live map retains the pin and Street View at native browser zoom from 80 to 200 percent', async ({ baseURL }) => {
  test.setTimeout(120_000)
  await mkdir(output, { recursive: true })
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-map-zoom-'))
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport: null,
    deviceScaleFactor: undefined, baseURL, args: ['--window-size=1440,900'] })
  try {
    const settings = await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page = await context.newPage()
    await start(page)
    await page.locator('.sp-world-panel .sp-google-map').click({ position: { x: 170, y: 100 } })
    const pin = await page.locator('.sp-map-status').innerText()
    const pano = await page.locator('.sp-panorama').getAttribute('data-panorama')
    const report = []
    for (const zoom of [80, 100, 125, 150, 200]) {
      await settings.locator('#zoomLevel').selectOption({ label: `${zoom}%` })
      await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom / 100, 1)
      await page.evaluate(() => scrollTo(0, 0))
      report.push({ zoom, ...await inspect(page) })
      await expect(page.locator('.sp-map-status')).toHaveText(pin)
      await expect(page.locator('.sp-panorama')).toHaveAttribute('data-panorama', pano!)
      await page.evaluate(() => scrollTo(0, 0))
      const cdp = await context.newCDPSession(page)
      const { contentSize } = await cdp.send('Page.getLayoutMetrics')
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } })
      await writeFile(`${output}/zoom-${zoom}.png`, Buffer.from(shot.data, 'base64'))
      await cdp.detach()
    }
    await writeFile(`${output}/zoom-report.json`, JSON.stringify(report, null, 2) + '\n')
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
    await page.keyboard.press('Enter')
    const scored = await response
    expect(scored.ok()).toBe(true)
    await finalizeIfNeeded(page, await scored.json())
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('touch map supports placing a pin and restoring it after collapse on a small phone', async ({ browser, baseURL }) => {
  test.setTimeout(90_000)
  await mkdir(output, { recursive: true })
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await start(page)
    await inspect(page)
    await page.locator('.sp-world-panel .sp-google-map').tap({ position: { x: 150, y: 90 } })
    const pin = await page.locator('.sp-map-status').innerText()
    await page.getByRole('button', { name: 'World Explorer', exact: true }).tap()
    await page.getByRole('button', { name: 'World Explorer', exact: true }).tap()
    await expect(page.locator('.sp-map-status')).toHaveText(pin)
    for (const selector of ['.sp-map-mode', '.sp-map-expand', '.sp-map-submit']) {
      expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${output}/touch-320x568.png`, fullPage: true })
    const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guess', exact: true }).tap()
    const scored = await response
    expect(scored.ok()).toBe(true)
    await finalizeIfNeeded(page, await scored.json())
  } finally {
    await context.close()
  }
})

test('hover expansion and Escape preserve the pin; a collapsed map stays compact on hover', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  const panel = page.locator('.sp-world-panel')
  await panel.locator('.sp-google-map').click({ position: { x: 170, y: 100 } })
  const pin = await page.locator('.sp-map-status').innerText()
  await page.getByRole('button', { name: 'Game settings', exact: true }).click()
  await page.getByRole('switch', { name: 'Expand map on hover' }).check()
  await page.keyboard.press('Escape')
  await panel.hover()
  await expect(panel).toHaveClass(/sp-guess-expanded/)
  await panel.getByRole('button', { name: 'World Explorer', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(panel).not.toHaveClass(/sp-guess-expanded/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.sp-map-status')).toHaveText(pin)
  await page.getByRole('button', { name: 'World Explorer', exact: true }).click()
  await page.mouse.move(0, 0)
  await panel.hover()
  await expect(panel).not.toHaveClass(/sp-guess-expanded/)
  await expect(page.locator('#guess-map-content')).toBeHidden()
  await page.getByRole('button', { name: 'World Explorer', exact: true }).click()
  await expect(page.locator('.sp-map-status')).toHaveText(pin)
})
