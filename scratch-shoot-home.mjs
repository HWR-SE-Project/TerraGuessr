import { chromium } from 'playwright-core'

const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/ebe20ab5-b62f-411c-a341-4129cfccd474/scratchpad'

async function main() {
  const browser = await chromium.launch()

  const desktop = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const dpage = await desktop.newPage()
  dpage.on('console', (m) => { if (m.type() === 'error') console.log('DESKTOP ERR:', m.text()) })
  dpage.on('pageerror', (e) => console.log('DESKTOP PAGEERROR:', e.message))
  await dpage.goto('http://localhost:5173/')
  await dpage.waitForTimeout(1800)
  await dpage.screenshot({ path: `${OUT}/desktop-1711x864.png` })
  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mobile.newPage()
  mpage.on('pageerror', (e) => console.log('MOBILE PAGEERROR:', e.message))
  await mpage.goto('http://localhost:5173/')
  await mpage.waitForTimeout(1800)
  await mpage.screenshot({ path: `${OUT}/mobile-390x844.png` })
  await mobile.close()

  await browser.close()
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) })
