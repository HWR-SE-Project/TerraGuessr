import { chromium } from 'playwright-core'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 2400 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Sign up' }).first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/dbg3.png' })
  const labels = await page.locator('label').allTextContents()
  console.log('labels:', labels)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
