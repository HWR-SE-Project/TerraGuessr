import { chromium } from 'playwright-core'
const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/ebe20ab5-b62f-411c-a341-4129cfccd474/scratchpad'
async function main() {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(1800)
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const g = c.getContext('webgl2') || c.getContext('webgl')
    const dbg = g.getExtension('WEBGL_debug_renderer_info')
    return dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })
  console.log('renderer:', gl)
  await page.screenshot({ path: `${OUT}/headed-desktop.png` })
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
