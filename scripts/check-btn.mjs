import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:8080/')
await page.locator('.th-header').waitFor()
const el = page.locator('.th-desktop-utilities .th-tutorial-entry').first()
const s = await el.evaluate(n => { const c = getComputedStyle(n); return {
  background: c.backgroundColor, backgroundImage: c.backgroundImage, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor,
  borderRadius: c.borderRadius, color: c.color, width: c.width, height: c.height, backdropFilter: c.backdropFilter, boxShadow: c.boxShadow } })
console.log(JSON.stringify(s, null, 2))
// check which layer wins for background by toggling
await browser.close()
