import { chromium } from 'playwright-core'
const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/ebe20ab5-b62f-411c-a341-4129cfccd474/scratchpad'
async function main() {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/headed-mobile.png` })
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
