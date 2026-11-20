import { chromium } from 'playwright-core'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text()))
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(2500)
  await browser.close()
}
main()
