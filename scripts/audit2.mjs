import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'
const browser = await chromium.launch()

async function styles(page, sel) {
  const el = page.locator(sel).first()
  if (!(await el.count())) return null
  return el.evaluate(n => {
    const s = getComputedStyle(n)
    return { bgImage: s.backgroundImage.slice(0, 120), bg: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, weight: s.fontWeight, border: s.borderTopColor }
  })
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'u1', displayName: 'Maxim Explorer', email: 'm@e.test', hasPassword: true } } }))

// Lobby create — flat primary "Create lobby" + difficulty selection + inputs
await page.goto(`${BASE}/multiplayer/create`, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1300)
console.log('header:', JSON.stringify(await styles(page, '.tg-page-nav[data-navigation-context=page] .th-header')))
console.log('nav segmented:', JSON.stringify(await styles(page, '.th-navigation')))
console.log('create-lobby flat primary:', JSON.stringify(await styles(page, '.tl-entry-footer .tg-button')))
console.log('difficulty selected:', JSON.stringify(await styles(page, '.tg-selection[aria-checked=true]')))
console.log('join code input:', JSON.stringify(await styles(page, '.tg-field')))
console.log('active nav link (create):', JSON.stringify(await styles(page, '.th-nav-link[aria-current=page]')))

// Auth — enabled provider buttons (light + tinted)
await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1300)
console.log('google (light):', JSON.stringify(await styles(page, '.geo-landing__provider--google')))
console.log('email (tinted):', JSON.stringify(await styles(page, '.geo-landing__provider--email')))
console.log('signup card:', JSON.stringify(await styles(page, '.geo-landing__signup-card')))

// Mobile overflow sweep
for (const w of [1280, 1024, 768, 560, 390]) {
  await page.setViewportSize({ width: w, height: 844 })
  for (const path of ['/', '/auth', '/settings', '/multiplayer/create']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(600)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    if (over > 0) console.log(`OVERFLOW ${w} ${path}: ${over}px`)
  }
}
console.log('mobile sweep done')

await browser.close()
