// Inspection harness for the shared AppHeader navigation.
// Renders pages at key viewports, captures screenshots and dumps precise
// geometry + computed styles so the redesign can be verified numerically.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080'
const OUT = 'docs/screenshots/nav-redesign'

async function metrics(page, selector) {
  const el = page.locator(selector).first()
  const box = await el.boundingBox()
  const style = await el.evaluate(node => {
    const s = getComputedStyle(node)
    return {
      color: s.color,
      background: s.backgroundColor || s.backgroundImage,
      borderColor: s.borderTopColor,
      borderRadius: s.borderTopLeftRadius,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      letterSpacing: s.letterSpacing,
      backdropFilter: s.backdropFilter,
      boxShadow: s.boxShadow,
      display: s.display,
    }
  })
  return { box, style }
}

async function snapshot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

function row(label, box) {
  if (!box) return `${label}: <missing>`
  return `${label}: x=${box.x.toFixed(1)} y=${box.y.toFixed(1)} w=${box.width.toFixed(1)} h=${box.height.toFixed(1)}`
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const report = {}

  // Signed-out home, desktop
  await page.goto(`${BASE}/`)
  await page.locator('.th-header').waitFor()
  await page.waitForTimeout(1200)
  const h = await metrics(page, '.th-header')
  const brand = await metrics(page, '.th-brand')
  const nav = await metrics(page, '.th-navigation')
  const single = await metrics(page, '.th-nav-link')
  const profile = await metrics(page, '.th-profile-link')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  report.desktopHome = {
    header: row('header', h.box),
    headerStyle: h.style,
    brand: row('brand', brand.box),
    nav: row('nav', nav.box),
    single: row('single', single.box),
    singleStyle: single.style,
    profile: row('profile', profile.box),
    profileStyle: profile.style,
    overflow,
  }
  await snapshot(page, 'desktop-home.png')

  // Dropdown open
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await page.waitForTimeout(300)
  const menu = await metrics(page, '.th-multiplayer-menu')
  const opt = await metrics(page, '.th-multiplayer-option')
  report.desktopDropdown = { menu: row('menu', menu.box), menuStyle: menu.style, option: row('option', opt.box) }
  await snapshot(page, 'desktop-dropdown.png')
  await page.keyboard.press('Escape')

  // Signed-in home, desktop
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'u1', displayName: 'Maxim Explorer', email: 'm@e.test' } } }))
  await page.goto(`${BASE}/`)
  await page.locator('.th-header').waitFor()
  await page.waitForTimeout(800)
  const signedIn = await metrics(page, '.th-profile-link')
  report.desktopSignedIn = { profile: row('profile', signedIn.box), style: signedIn.style }
  await snapshot(page, 'desktop-signed-in.png')
  await page.unroute('**/api/auth/session')

  // Mobile, nav open
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/`)
  await page.locator('.th-header').waitFor()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.waitForTimeout(300)
  const mNav = await metrics(page, '.th-navigation')
  const mBrand = await metrics(page, '.th-brand')
  report.mobileNav = { nav: row('nav', mNav.box), brand: row('brand', mBrand.box), overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) }
  await snapshot(page, 'mobile-nav.png')
  // Mobile multiplayer dropdown
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await page.waitForTimeout(300)
  const mMenu = await metrics(page, '.th-multiplayer-menu')
  report.mobileDropdown = { menu: row('menu', mMenu.box), overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) }
  await snapshot(page, 'mobile-dropdown.png')

  await browser.close()
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
