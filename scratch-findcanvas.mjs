import { chromium } from 'playwright-core'
async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext()).newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(1500)
  const canvases = await page.locator('canvas').all()
  console.log('canvas count', canvases.length)
  for (const c of canvases) {
    console.log(await c.evaluate((el) => el.outerHTML.slice(0, 200)))
  }
  await browser.close()
}
main()
