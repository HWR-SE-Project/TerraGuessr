import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/shared-cosmic'
const report = { checks: {}, screenshots: [], errors: [] }
const browser = await chromium.launch({ headless: false })
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, scale: 'css' })
  report.screenshots.push(`${name}.png`)
}
async function sky(page) {
  await page.waitForFunction(() => document.querySelector('.cosmic-background[data-ready="true"] canvas'))
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
    const state = (await import(url))._roots.get(document.querySelector('canvas')).store.getState()
    const env = state.scene.getObjectByName('home-cosmic-environment')
    return { count: env.children.filter(o => o.isPoints).reduce((sum, o) => sum + o.geometry.attributes.position.count, 0) }
  })
}
try {
  const weak = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const wp = await weak.newPage()
  await wp.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 })
    Object.defineProperty(navigator, 'deviceMemory', { value: 2 })
  })
  await wp.goto(`${baseURL}/auth`)
  const low = await sky(wp)
  assert.equal(low.count, 4797)
  assert(!(await wp.evaluate(() => performance.getEntriesByType('resource').some(e => /puppet-kid|earth-origami/.test(e.name)))))
  report.checks.weakDevice = { starCount: low.count, homeModelsNotDownloadedForAuth: true }
  await weak.close()

  const account = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const page = await account.newPage()
  page.on('pageerror', e => report.errors.push(e.message))
  await page.goto(`${baseURL}/auth`)
  await page.getByRole('button', { name: 'Continue with Email' }).click()
  await shot(page, 'auth-email-desktop')
  await page.getByLabel('Display name').fill('Cosmic Explorer')
  await page.getByLabel('Email', { exact: true }).fill(`cosmic-explorer-${Date.now()}@example.test`)
  await page.getByLabel('Password', { exact: false }).fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Avatar' }).waitFor()
  // Keep event pools from allocating their first GPU buffers mid-measurement.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
    window.__cosmicStore = (await import(url))._roots.get(document.querySelector('.cosmic-background canvas')).store
  })
  const memories = []
  for (let cycle = 0; cycle < 5; cycle++) {
    for (const path of ['/duels', '/', '/auth']) {
      // The signed-in Auth route redirects to Home, so end each cycle on Duels.
      const destination = path === '/auth' ? '/duels' : path
      await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, destination)
      if (destination === '/') await page.locator('[data-character-status="ready"]').waitFor()
      await page.waitForTimeout(500)
    }
    await page.evaluate(() => new Promise(resolve => requestIdleCallback(() => resolve(undefined), { timeout: 1500 })))
    await page.waitForTimeout(300)
    memories.push(await page.evaluate(() => {
      const state = window.__cosmicStore.getState()
      return { ...state.gl.info.memory, programs: state.gl.info.programs.length }
    }))
  }
  console.log('Home navigation resource samples:', memories)
  const settled = memories.slice(1)
  const stable = settled.every(m => m.geometries === settled[0].geometries && m.textures === settled[0].textures && m.programs === settled[0].programs)
  report.checks.homeNavigationMemory = { cycles: 5, warmupCycles: 1, reducedMotionDuringMeasurement: true, stable, samples: memories }
  assert(stable)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`${baseURL}/settings`)
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
  await shot(page, 'settings-account-desktop')
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await shot(page, 'settings-preferences-desktop')
  await page.goto(`${baseURL}/play`)
  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Start playing', exact: true }).click()
  for (let number = 1; number <= 3; number++) {
    await page.getByTestId('weather-panel').waitFor({ timeout: 30000 })
    if (number === 1) {
      await shot(page, 'weather-round-desktop')
      await page.setViewportSize({ width: 390, height: 844 }); await shot(page, 'weather-round-mobile')
      await page.setViewportSize({ width: 1711, height: 864 })
    }
    await page.locator('.tg-map-picker').click({ position: { x: 150, y: 130 } })
    await page.getByRole('button', { name: 'Submit guess', exact: true }).click()
    await page.locator('.tg-play-result-score-value').waitFor()
    if (number === 1) {
      await shot(page, 'weather-result-desktop')
      await page.setViewportSize({ width: 390, height: 844 }); await shot(page, 'weather-result-mobile')
      await page.setViewportSize({ width: 1711, height: 864 })
    }
    await page.getByRole('button', { name: number === 3 ? 'View summary' : 'Next round', exact: true }).click()
  }
  await page.getByText('Expedition complete').waitFor()
  await shot(page, 'weather-summary-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'weather-summary-mobile')
  await page.goto(`${baseURL}/settings`)
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
  await shot(page, 'settings-account-mobile')
  await page.getByRole('button', { name: 'Preferences', exact: true }).click()
  await shot(page, 'settings-preferences-mobile')
  report.checks.accountAndWeather = { accountAndPreferencesUsable: true, threeWeatherRoundsAndSummary: true }
  await account.close()
  const authMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await authMobile.goto(`${baseURL}/auth`)
  await authMobile.getByRole('button', { name: 'Continue with Email' }).click()
  await shot(authMobile, 'auth-email-mobile')
  await authMobile.getByRole('button', { name: 'Log in', exact: true }).first().click()
  await authMobile.getByRole('button', { name: 'Continue with Email' }).click()
  await shot(authMobile, 'auth-login-mobile')
  const forgot = authMobile.getByRole('button', { name: 'Forgot password?' })
  if (await forgot.isVisible()) {
    await forgot.click(); await shot(authMobile, 'auth-forgot-mobile')
  } else report.checks.passwordRecovery = 'Unavailable in local authentication configuration'
  await authMobile.close()
  assert.deepEqual(report.errors, [])
} finally {
  await writeFile(`${out}/extra-verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
