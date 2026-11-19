import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/overhaul/after'
await mkdir(out, { recursive: true })
const sizes = [
  [1920, 1080],
  [1711, 864],
  [1440, 900],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [375, 812],
]
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) =>
  errors.push(e.message.replace(/AIza[\w-]+/g, '[REDACTED]')),
)
const report = { baseURL, viewports: [], errors, functionality: {} }
const shot = async (name, fullPage = true) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage })
}
const layout = async (name, w, h) => {
  const data = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    headings: [...document.querySelectorAll('h1')].map((e) => e.textContent),
  }))
  if (data.width !== w)
    throw new Error(`${name}: horizontal overflow ${data.width} at ${w}`)
  if (name.includes('results')) {
    const visible = await page.locator('.sp-result-actions').evaluate(e => {
      const a = e.getBoundingClientRect(); const p = e.closest('.sp-results').getBoundingClientRect()
      return a.top >= p.top && a.bottom <= p.bottom + 1 && a.bottom <= innerHeight
    })
    if (!visible) throw new Error(`${name}: result actions are clipped at ${w}x${h}`)
  }
  report.viewports.push({
    page: name,
    width: w,
    height: h,
    horizontalOverflow: false,
  })
}
try {
  for (const [name, route] of [
    ['home', '/'],
    ['duels', '/duels'],
    ['auth', '/auth'],
    ['weather-expedition', '/play'],
    ['password-reset', '/reset-password'],
  ]) {
    await page.goto(route)
    await page.waitForTimeout(1200)
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(180)
      await layout(name, w, h)
      await shot(`${name}-${w}x${h}`)
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign up', exact: true }).first().click()
  await page.getByRole('button', { name: 'Continue with Email' }).click()
  await shot('auth-email-desktop')
  await page.getByLabel('Display name').fill('Terra Explorer')
  await page
    .getByLabel('Email')
    .fill(`visual-review-${Date.now()}@example.test`)
  await page
    .getByLabel('Password', { exact: false })
    .fill('curiosity-knows-no-borders')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(baseURL + '/')
  report.functionality.registration = true
  await page.goto('/settings')
  await page.getByLabel('Display name').waitFor()
  await shot('settings-account-desktop')
  await page.getByRole('button', { name: 'Preferences' }).click()
  await shot('settings-preferences-desktop')
  for (const [w, h] of [
    [768, 1024],
    [390, 844],
    [375, 812],
  ]) {
    await page.setViewportSize({ width: w, height: h })
    await layout('settings', w, h)
    await shot(`settings-${w}x${h}`)
  }
  await page.goto('/daily')
  await page.getByText(/Loading today's challenge/).waitFor({ state: 'hidden' })
  await page.locator('.tg-daily-map .leaflet-tile-loaded').first().waitFor({timeout:15000}).catch(() => { report.functionality.dailyTileProviderAvailable = false })
  await shot('daily-mobile')
  await page.setViewportSize({ width: 1440, height: 900 })
  await shot('daily-desktop')
  await page.goto('/game/singleplayer')
  await page
    .locator('.sp-panorama[data-ready="true"]')
    .waitFor({ timeout: 45000 })
  await page.waitForTimeout(1600)
  report.functionality.streetView = true
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(250)
    await layout('gameplay', w, h)
    await shot(`gameplay-${w}x${h}`, false)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Game settings' }).click()
  await shot('game-settings-desktop', false)
  await page.keyboard.press('Escape')
  report.functionality.dialogEscape = await page
    .getByRole('button', { name: 'Game settings' })
    .evaluate((e) => document.activeElement === e)
  await page.getByRole('button', { name: 'Game menu' }).click()
  await shot('game-menu-desktop', false)
  await page.getByRole('button', { name: 'Resume game' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Geographic intelligence' }).click()
  await shot('intelligence-mobile', false)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })
  // Real provider, real round progression, and server scoring throughout.
  for (let number = 1; number <= 5; number++) {
    await page
      .locator('.sp-panorama[data-ready="true"]')
      .waitFor({ timeout: 45000 })
    const expand = page.getByRole('button', { name: 'Expand map', exact: true })
    if (await expand.isVisible()) await expand.click()
    await page.mouse.move(500, 100)
    const map = page.locator('.sp-guess-panel .sp-google-map')
    await map.locator('img').first().waitFor({ timeout: 15000 })
    await map.click({ position: { x: 220, y: 160 } })
    if (number === 1) {
      await shot('expanded-map-desktop', false)
      await page.setViewportSize({ width: 390, height: 844 })
      await shot('expanded-map-mobile', false)
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    await page.getByRole('button', { name: 'Guess', exact: true }).click()
    await page.getByRole('region', { name: 'Round results' }).waitFor()
    if (number === 1) {
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h })
        await page.waitForTimeout(200)
        await layout('round-results', w, h)
        await shot(`round-results-${w}x${h}`, false)
      }
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    await page
      .getByRole('button', {
        name: number === 5 ? 'View final results' : 'Next round',
      })
      .click()
  }
  await page.getByRole('region', { name: 'Final results' }).waitFor()
  report.functionality.fiveRealRounds = true
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(200)
    await layout('final-results', w, h)
    await shot(`final-results-${w}x${h}`, false)
  }
  await page.locator('.sp-round-list summary').first().click()
  report.functionality.resultDetails = await page
    .locator('.sp-round-list details')
    .first()
    .evaluate((e) => e.open)
  await page.getByRole('button', { name: 'Return home', exact: true }).click()
  await page.getByRole('heading', { name: 'Explore the World' }).waitFor()
  report.functionality.returnHome = true
  // WebGL fallback and reduced motion are part of the supported experience.
  const fallback = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).includes('webgl')) return null
      return original.call(this, type, ...args)
    }
  })
  const fp = await fallback.newPage()
  await fp.goto('/')
  await fp.screenshot({ path: `${out}/home-no-webgl-reduced-motion.png` })
  report.functionality.webGLFallback = await fp
    .locator('.th-earth img')
    .isVisible()
  await fallback.close()
  console.log(
    JSON.stringify(
      {
        checks: report.viewports.length,
        errors,
        functionality: report.functionality,
      },
      null,
      2,
    ),
  )
} finally {
  await writeFile(
    `${out}/visual-qa.json`,
    JSON.stringify(report, null, 2) + '\n',
  )
  await browser.close()
}
