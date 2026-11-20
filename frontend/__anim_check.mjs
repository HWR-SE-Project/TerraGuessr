import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/d8e1af69-fb8d-4660-bdc7-9ae7324864e0/scratchpad/anim-check'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const consoleMsgs = []
page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('.th-character-slot', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)

const slotBox = await page.evaluate(() => {
  const el = document.querySelector('.th-character-slot')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
fs.writeFileSync(`${OUT}/slotBox.json`, JSON.stringify(slotBox, null, 2))

// Capture a burst of frames over ~4 seconds to see if the pose visibly changes.
const clip = slotBox ? { x: Math.max(0, slotBox.x - 20), y: Math.max(0, slotBox.y - 20), width: slotBox.width + 40, height: slotBox.height + 40 } : undefined
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `${OUT}/frame_${String(i).padStart(2, '0')}.png`, clip })
  await page.waitForTimeout(500)
}

// Full-page screenshot for overall composition check.
await page.screenshot({ path: `${OUT}/full_page.png`, fullPage: false })

fs.writeFileSync(`${OUT}/console.log`, consoleMsgs.join('\n'))

await browser.close()
console.log('done')
