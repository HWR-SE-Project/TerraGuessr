import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1792, height: 861 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
async function capture(route, filename, fullPage = false) {
  await page.goto(`${base}${route}`)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})))
  })
  await page.screenshot({ path: path.join(out, filename), fullPage })
}
await capture('/', 'after-home.png')
await capture('/auth', 'after-auth.png')
await capture('/duels', 'desktop-guest-1792x861.png')
const responsive = []
for (const width of [320, 360, 390, 600, 768, 1024, 1100, 1280, 1440, 1792, 2100]) {
  await page.setViewportSize({ width, height: 861 })
  responsive.push(await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, play: rect('.td-play'), ranks: rect('.td-ranks') }
  }))
}
await page.setViewportSize({ width: 768, height: 1024 })
await capture('/duels', 'tablet-768.png', true)
await page.setViewportSize({ width: 1280, height: 800 })
await capture('/duels', 'laptop-1280.png')
await context.close()

// Reuse the existing local account session. Cookies are never exported into
// this report or committed; the session file is ignored by the repository.
const account = await browser.newContext({ viewport: { width: 1792, height: 861 }, storageState: path.join(out, '../home/session.local.json') })
const accountPage = await account.newPage()
accountPage.on('pageerror', error => errors.push(error.message))
await accountPage.goto(`${base}/duels`)
await accountPage.getByRole('button', { name: 'Play', exact: true }).waitFor()
await accountPage.waitForFunction(() => !document.querySelector('.td-player-left')?.getAttribute('aria-busy')?.includes('true'))
await accountPage.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))) })
const displayedName = await accountPage.locator('.td-player-left').textContent()
await accountPage.screenshot({ path: path.join(out, 'desktop-1792x861.png') })
await accountPage.setViewportSize({ width: 390, height: 844 })
await accountPage.screenshot({ path: path.join(out, 'mobile-390.png') })
await accountPage.screenshot({ path: path.join(out, 'mobile-full-390.png'), fullPage: true })
await accountPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await accountPage.screenshot({ path: path.join(out, 'mobile-ranks-390.png') })
await account.close()
await browser.close()
const report = { viewport: { width: 1792, height: 861 }, referenceAvailable: false, referenceComparison: 'Pending: no reference screenshot was attached to the received task.', displayedName, errors, responsive }
await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
