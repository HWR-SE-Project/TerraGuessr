import { chromium } from 'playwright-core'
import path from 'node:path'

const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/801f97e9-5714-4fb0-a42b-7f3d7dcec71c/scratchpad'

async function main() {
  const browser = await chromium.launch()

  const desktopCtx = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const page = await desktopCtx.newPage()
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(OUT, 'current-desktop.png'), fullPage: false })
  await desktopCtx.close()

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mobileCtx.newPage()
  await mpage.goto('http://localhost:5173/')
  await mpage.waitForTimeout(2500)
  await mpage.screenshot({ path: path.join(OUT, 'current-mobile.png'), fullPage: false })
  await mobileCtx.close()

  await browser.close()
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) })
