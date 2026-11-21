import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'
const OUT = 'docs/screenshots/redesign'
const VW = process.env.VW ? Number(process.env.VW) : 1440

async function shot(page, path, w = VW, h = 900) {
  await page.setViewportSize({ width: w, height: h })
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `${OUT}/${path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-')}@${w}.png` })
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()

// Mock a signed-in session for settings/profile views.
await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'u1', displayName: 'Maxim Explorer', email: 'm@e.test', hasPassword: true } } }))

for (const path of ['/', '/auth', '/settings', '/multiplayer/create']) {
  await shot(page, path)
}
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/home@390.png` })

await browser.close()
console.log('done ->', OUT)
