import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StreetRound } from '../frontend/src/api/singleplayer'

// Exercise the real selection/submission path and Google imagery, as well as
// genuine browser zoom (changing a viewport or CSS zoom would miss regressions).
test.use({ channel: 'chromium' })
test.skip(process.env.TERRAGUESSR_LIVE_MAPS !== '1', 'Requires the running backend and live Maps credentials')
const output = 'docs/screenshots/easy-city-selection'

async function startEasy(page: Page) {
  await page.goto('/game/singleplayer')
  await page.getByRole('radio', { name: /Easy/ }).click()
  const response = page.waitForResponse(r => r.url().endsWith('/rounds') && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
  const round = await (await response).json() as StreetRound
  await expect(page.locator('.sp-panorama')).toHaveAttribute('data-ready', 'true', { timeout: 45_000 })
  await expect(page.getByTestId('candidate-option')).toHaveCount(6)
  await page.waitForTimeout(1200) // Google's ready event precedes imagery painting.
  return round
}

async function layout(page: Page, mayScroll: boolean) {
  const panel = page.getByRole('complementary', { name: 'City selection' })
  for (const control of await panel.locator('button').all()) {
    if (mayScroll) await control.scrollIntoViewIfNeeded()
    expect(await control.evaluate(el => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && !!hit && el.contains(hit)
    }), await control.innerText()).toBe(true)
  }
  const metrics = await panel.evaluate(el => {
    const p = el.getBoundingClientRect()
    const rows = [...el.querySelectorAll('.tg-candidate-row')].map(row => {
      const r = row.getBoundingClientRect()
      return { top: r.top - p.top, bottom: r.bottom - p.top, height: r.height }
    })
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight, pixelRatio: devicePixelRatio,
      panelWidth: p.width, panelHeight: p.height,
      headerHeight: el.querySelector('header')!.getBoundingClientRect().height,
      rows,
      internalScroll: [...el.querySelectorAll('*')].some(child => {
        const css = getComputedStyle(child)
        return ['auto', 'scroll'].includes(css.overflowY) && child.scrollHeight > child.clientHeight
      }),
    }
  })
  expect(metrics.scrollWidth).toBe(metrics.width)
  expect(metrics.internalScroll).toBe(false)
  expect(metrics.rows.every(row => row.top >= 0 && row.bottom < metrics.panelHeight)).toBe(true)
  if (!mayScroll) expect(metrics.scrollHeight).toBe(metrics.height)
  return metrics
}

test('Easy panel: all cities fit, selection switches, collapse preserves it, and submission uses the selected coordinates', async ({ page }) => {
  test.setTimeout(120_000)
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1366, height: 768 })
  const round = await startEasy(page)
  const guess = page.getByRole('button', { name: 'Guess', exact: true })
  await expect(guess).toBeDisabled()
  await page.screenshot({ path: `${output}/unselected-1366x768.png` })
  const options = page.getByTestId('candidate-option')
  for (let i = 0; i < 6; i++) {
    await options.nth(i).click()
    await expect(options.nth(i)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.tg-candidate-row[aria-pressed=true]')).toHaveCount(1)
    await expect(options.nth(i).locator('.tg-candidate-mark')).toBeVisible()
  }
  await options.nth(2).focus()
  await page.keyboard.press('Enter')
  await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /Pick a city/ }).click()
  await expect(options.nth(2)).toBeHidden()
  await page.getByRole('button', { name: /Pick a city/ }).click()
  await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(guess).toBeEnabled()
  const report = []
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => scrollTo(0, 0))
    const metrics = await layout(page, width < 1000)
    expect(metrics.panelWidth).toBeLessThanOrEqual(304)
    expect(metrics.panelHeight).toBeLessThan(340)
    expect(metrics.headerHeight).toBeLessThan(40)
    report.push(metrics)
    await page.mouse.move(0, 0)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${output}/after-${width}x${height}.png`, fullPage: true })
    if (width === 1366) await page.locator('.tg-city-panel').screenshot({ path: `${output}/city-panel.png` })
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
  await guess.click()
  const submitted = await response
  expect(submitted.request().postDataJSON()).toEqual({ lat: round.candidates![2].lat, lon: round.candidates![2].lon, final: false })
  expect(submitted.ok()).toBe(true)
  if (!(await submitted.json()).finalized) {
    await expect(page.getByRole('button', { name: 'Final submit', exact: true })).toBeEnabled()
    await expect(guess).toBeEnabled()
    await page.screenshot({ path: `${output}/remaining-attempts.png` })
    await layout(page, false)
    await options.nth(3).click()
    const finalResponse = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Final submit', exact: true }).click()
    const final = await finalResponse
    expect(final.ok()).toBe(true)
    expect(final.request().postDataJSON()).toEqual({ lat: round.candidates![3].lat, lon: round.candidates![3].lon, final: true })
    expect((await final.json()).finalized).toBe(true)
  }
  await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
  await page.screenshot({ path: `${output}/submitted.png` })
  await writeFile(`${output}/viewport-report.json`, JSON.stringify(report, null, 2) + '\n')
})

test('Easy panel remains reachable at native browser zoom from 80 to 200 percent', async ({ baseURL }) => {
  test.setTimeout(120_000)
  await mkdir(output, { recursive: true })
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-city-zoom-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL,
    args: ['--window-size=1440,900'],
  })
  try {
    const settings = await context.newPage()
    await settings.goto('chrome://settings/appearance')
    const page = await context.newPage()
    await startEasy(page)
    await page.getByTestId('candidate-option').nth(2).click()
    const report = []
    for (const zoom of [80, 100, 125, 150, 200]) {
      await settings.locator('#zoomLevel').selectOption({ label: `${zoom}%` })
      await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom / 100, 1)
      await page.evaluate(() => scrollTo(0, 0))
      const metrics = await layout(page, zoom > 100)
      await expect(page.getByTestId('candidate-option').nth(2)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('button', { name: 'Guess', exact: true })).toBeEnabled()
      report.push({ zoom, ...metrics })
      await page.evaluate(() => scrollTo(0, 0))
      const cdp = await context.newCDPSession(page)
      const { contentSize } = await cdp.send('Page.getLayoutMetrics')
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } })
      await writeFile(`${output}/zoom-${zoom}.png`, Buffer.from(shot.data, 'base64'))
      await cdp.detach()
    }
    await writeFile(`${output}/zoom-report.json`, JSON.stringify(report, null, 2) + '\n')
    // The existing Enter shortcut also works after zoom and page scrolling.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    const response = page.waitForResponse(r => r.url().endsWith('/guess') && r.request().method() === 'POST')
    await page.keyboard.press('Enter')
    expect((await response).ok()).toBe(true)
    const final = page.getByRole('button', { name: 'Final submit', exact: true })
    await expect(final).toBeEnabled()
    await final.click()
    await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('Easy panel uses comfortable touch targets on a small phone', async ({ browser, baseURL }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await startEasy(page)
    await page.getByTestId('candidate-option').last().tap()
    await expect(page.getByTestId('candidate-option').last()).toHaveAttribute('aria-pressed', 'true')
    const metrics = await layout(page, true)
    expect(metrics.rows.every(row => row.height >= 44)).toBe(true)
    await page.screenshot({ path: `${output}/touch-320x568.png`, fullPage: true })
    await page.getByRole('button', { name: 'Guess', exact: true }).tap()
    const final = page.getByRole('button', { name: 'Final submit', exact: true })
    await expect(final).toBeEnabled()
    await final.tap()
    await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible()
  } finally {
    await context.close()
  }
})
