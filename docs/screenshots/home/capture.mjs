import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
const out = path.dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1711, height: 864 },
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
await page.goto('http://localhost:5173/auth')
await page.getByRole('button', { name: 'Sign up', exact: true }).first().click()
await page.getByRole('button', { name: 'Continue with Email' }).click()
await page.getByLabel('Display name').fill('BrowserExplorer')
await page.getByLabel('Email').fill(`home-visual-${Date.now()}@example.test`)
await page
  .getByLabel('Password', { exact: false })
  .fill('correct-horse-battery-staple')
await page.getByRole('button', { name: 'Create account' }).click()
await page.getByRole('link', { name: 'Play Solo' }).waitFor()
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(out, 'desktop-1711x864.png') })
await context.storageState({ path: path.join(out, 'session.local.json') })
const layout = await page
  .locator(
    '.th-header,.th-sidebar,.th-hero-copy,.th-avatar-display,.th-premium,.th-game-modes',
  )
  .evaluateAll((els) =>
    els.map((el) => ({
      name: el.className,
      rect: el.getBoundingClientRect().toJSON(),
    })),
  )
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({
  path: path.join(out, 'mobile-390.png'),
  fullPage: true,
})
await page.getByRole('button', { name: 'Open navigation' }).click()
await page
  .getByRole('link', { name: 'Multiplayer', exact: true })
  .waitFor({ state: 'visible' })
await page.getByRole('button', { name: 'Close navigation' }).click()
await page.getByRole('button', { name: 'View Plans' }).click()
await page.getByRole('dialog').waitFor({ state: 'visible' })
await page.keyboard.press('Escape')
await page.getByRole('dialog').waitFor({ state: 'detached' })
const responsive = []
for (const width of [320, 390, 768, 1024, 1280, 1711, 2100]) {
  await page.setViewportSize({ width, height: 864 })
  responsive.push({
    width,
    scrollWidth: await page.evaluate(
      () => document.documentElement.scrollWidth,
    ),
  })
}
await fs.writeFile(
  path.join(out, 'browser-results.json'),
  JSON.stringify({ errors, layout, responsive }, null, 2),
)
console.log(JSON.stringify({ errors, layout, responsive }, null, 2))
await browser.close()
