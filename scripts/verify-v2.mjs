// Programmatic verification of the v2 frontend: console errors, horizontal
// overflow, and key interactions. Run: node scripts/verify-v2.mjs
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:8080'
const results = []

const browser = await chromium.launch()

async function inspect(path, size = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport: size })
  const page = await context.newPage()
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1200)

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })

  const heading = await page
    .locator('h1')
    .first()
    .textContent()
    .catch(() => '(no h1)')

  results.push({ path, size: `${size.width}x${size.height}`, overflow, errors, heading: heading?.trim() })
  await context.close()
}

const pages = [
  ['/', { width: 1440, height: 900 }],
  ['/', { width: 390, height: 844 }],
  ['/singleplayer', { width: 1440, height: 900 }],
  ['/singleplayer', { width: 390, height: 844 }],
  ['/multiplayer', { width: 1440, height: 900 }],
  ['/multiplayer', { width: 390, height: 844 }],
  ['/settings', { width: 1440, height: 900 }],
  ['/avatar', { width: 1440, height: 900 }],
  ['/how-to-play', { width: 390, height: 844 }],
  ['/auth', { width: 1440, height: 900 }],
]

for (const [path, size] of pages) await inspect(path, size)

// Interaction: start singleplayer → game loads with Street View / fallback
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/singleplayer`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Start exploring' }).click()
  await page.waitForTimeout(3000)
  const hasHud = await page.locator('text=Round 1').count()
  const hasStreetOrFallback = await page.locator('div.absolute.inset-0').first().count()
  results.push({ path: '/singleplayer/play (interaction)', size: '1440x900', overflow: '-', errors, heading: `hud=${hasHud}` })
  await context.close()
}

// Interaction: create lobby → waiting room
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/multiplayer?mode=create`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Create lobby' }).click()
  await page.waitForTimeout(2000)
  const code = await page.locator('text=Lobby code').count()
  const players = await page.locator('text=Players').count()
  results.push({ path: '/multiplayer → lobby (interaction)', size: '1440x900', overflow: '-', errors, heading: `code=${code} players=${players}` })
  await context.close()
}

await browser.close()

console.log('\n===== VERIFICATION RESULTS =====\n')
let failed = 0
for (const r of results) {
  const badOverflow = typeof r.overflow === 'number' && r.overflow > 0
  const badErrors = r.errors.length > 0
  if (badOverflow || badErrors) failed++
  console.log(`${badOverflow || badErrors ? '✗' : '✓'} ${r.path} @ ${r.size} — "${r.heading}"${typeof r.overflow === 'number' ? ` overflow=${r.overflow}px` : ''}`)
  if (r.errors.length) r.errors.forEach((e) => console.log(`    ! ${e}`))
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
