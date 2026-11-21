import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'
const OUT = 'docs/screenshots/hud-inspect'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const selectors = [
  '.tg-page-nav', '.th-header', '.th-brand', '.th-player-tools',
  '.gi-panel', '.gi-header', '.sp-guess-panel', '.sp-world-panel',
  '.sp-map-header', '.sp-map-wrap', '.sp-map-footer', '.sp-compass',
  '.sp-bottom-bar', '.sp-hud', '.sp-panorama', '.sp-panorama-canvas',
]

async function geometry() {
  return page.evaluate((sels) => {
    const out = {}
    for (const sel of sels) {
      const el = document.querySelector(sel)
      if (!el) { out[sel] = null; continue }
      const r = el.getBoundingClientRect()
      out[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }
    }
    out.viewport = { w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight }
    // Street view native controls positions
    out.svControls = [...document.querySelectorAll('.sp-panorama button, .sp-panorama a')].map((el) => {
      const r = el.getBoundingClientRect()
      return { label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }).filter((c) => c.w > 0 && c.h > 0)
    return out
  }, selectors)
}

async function capture(name) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.sp-page')?.scrollTo(0, 0) })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

// Start a live game
await page.goto(`${BASE}/game/singleplayer`)
await page.getByRole('button', { name: /Start exploring/i }).click()
await page.locator('.sp-panorama').waitFor()
await page.locator('.sp-panorama[data-ready="true"]').waitFor({ timeout: 45000 })
await page.waitForTimeout(1200)

const report = {}
for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(300)
  report[`${w}x${h}`] = await geometry()
  await capture(`${w}x${h}`)
}

await writeFile(`${OUT}/geometry.json`, JSON.stringify({ errors, report }, null, 2) + '\n')
console.log(JSON.stringify({ errors, ...report }, null, 2))
await browser.close()
