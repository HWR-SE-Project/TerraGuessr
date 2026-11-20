import { chromium } from 'playwright-core'
async function main() {
  const browser = await chromium.launch({ headless: false })
  const page = await (await browser.newContext({ viewport: { width: 1711, height: 864 } })).newPage()
  page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text()))
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(2000)
  await browser.close()
}
main()
