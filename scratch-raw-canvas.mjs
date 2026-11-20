import { chromium } from 'playwright-core'
import fs from 'node:fs'

const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/ebe20ab5-b62f-411c-a341-4129cfccd474/scratchpad'

async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1711, height: 864 } })).newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(1800)
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    return canvas ? canvas.toDataURL('image/png') : null
  })
  if (!dataUrl) {
    console.log('no canvas found')
  } else {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(`${OUT}/raw-canvas.png`, Buffer.from(base64, 'base64'))
    console.log('saved raw-canvas.png')
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
