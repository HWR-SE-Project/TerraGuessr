import { chromium } from 'playwright-core'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('response', (res) => {
    if (res.status() >= 400) console.log('BAD RESPONSE:', res.status(), res.url())
  })
  page.on('requestfailed', (req) => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText))
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(2500)
  await browser.close()
}
main()
