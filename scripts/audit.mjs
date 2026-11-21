import { chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'

// WCAG contrast ratio
function lum(r, g, b) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function parse(c) {
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
function contrast(fg, bg) {
  const a = parse(fg), b = parse(bg)
  if (!a || !b) return null
  const l1 = lum(...a), l2 = lum(...b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'u1', displayName: 'Maxim Explorer', email: 'm@e.test', hasPassword: true } } }))

const report = {}

async function audit(name, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1300)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  const fonts = await page.evaluate(() => {
    const body = getComputedStyle(document.body).fontFamily
    const h1 = document.querySelector('h1')
    return { body, h1: h1 ? getComputedStyle(h1).fontFamily : null }
  })
  const key = {}
  for (const sel of ['.th-header', '.tg-control--primary', '.tg-glass', '.sp-hud']) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      key[sel] = await el.evaluate(n => {
        const s = getComputedStyle(n)
        return { bg: s.backgroundColor || s.backgroundImage.slice(0, 80), color: s.color, radius: s.borderTopLeftRadius, shadow: s.boxShadow.slice(0, 70), weight: s.fontWeight }
      })
    }
  }
  report[name] = { overflow, fonts, key }
  console.log(`\n=== ${name} (${url}) ===`)
  console.log('overflowX:', overflow)
  console.log('fonts:', JSON.stringify(fonts))
  for (const [sel, v] of Object.entries(key)) console.log(sel, JSON.stringify(v))
}

// contrast spot-checks on home
async function contrastCheck(name, url, pairs) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1300)
  console.log(`\n=== contrast ${name} ===`)
  for (const [label, fgSel, bgSel] of pairs) {
    const fg = page.locator(fgSel).first(), bg = page.locator(bgSel).first()
    if (!(await fg.count()) || !(await bg.count())) { console.log(label, 'SKIP'); continue }
    const c = contrast(await fg.evaluate(n => getComputedStyle(n).color), await bg.evaluate(n => getComputedStyle(n).backgroundColor))
    console.log(label, c)
  }
}

await audit('home', '/')
await audit('auth', '/auth')
await audit('settings', '/settings')
await audit('lobby-create', '/multiplayer/create')

await contrastCheck('home-cta', '/', [
  ['signin-btn ink vs bg', '.th-profile-link--signin', '.th-profile-link--signin'],
  ['brand vs header', '.tg-brand-word', '.th-header'],
  ['hero h1 vs bg', '.th-hero h1', '.th-home'],
])
await contrastCheck('primary-btn', '/', [['primary ink', '.tg-control--primary', '.tg-control--primary']])

await browser.close()
