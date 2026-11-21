import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'
const browser = await chromium.launch()
async function styles(page, sel) {
  const el = page.locator(sel).first()
  if (!(await el.count())) return null
  return el.evaluate(n => {
    const s = getComputedStyle(n)
    return { bgImage: s.backgroundImage.slice(0, 120), bg: s.backgroundColor, color: s.color, radius: s.borderTopLeftRadius, weight: s.fontWeight }
  })
}

// Signed-out auth (no session mock)
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.route('**/api/auth/session', r => r.fulfill({ json: { user: null } }))
await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(1500)
console.log('auth h1:', JSON.stringify(await styles(page, '.geo-landing__hero h1')))
console.log('signup card:', JSON.stringify(await styles(page, '.geo-landing__signup-card')))
console.log('google (light):', JSON.stringify(await styles(page, '.geo-landing__provider--google')))
console.log('email (tinted):', JSON.stringify(await styles(page, '.geo-landing__provider--email')))
console.log('signin pill (header):', JSON.stringify(await styles(page, '.th-profile-link--signin')))

// Singleplayer setup
await page.goto(`${BASE}/game/singleplayer`, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(2500)
console.log('\nsingleplayer setup welcome:', JSON.stringify(await styles(page, '.sp-welcome')))
console.log('setup h1:', JSON.stringify(await styles(page, '.sp-setup-intro h1')))
console.log('start exploring (primary):', JSON.stringify(await styles(page, '.sp-setup-options .tg-button--primary')))
console.log('difficulty legend:', JSON.stringify(await styles(page, '.tg-difficulty legend')))
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
console.log('sp setup overflowX:', overflow)

await browser.close()
