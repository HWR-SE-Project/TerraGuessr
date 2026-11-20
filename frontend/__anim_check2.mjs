import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const rm = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
console.log('prefers-reduced-motion reduce matches:', rm)

const docHidden = await page.evaluate(() => document.hidden)
console.log('document.hidden:', docHidden)

const visState = await page.evaluate(() => document.visibilityState)
console.log('visibilityState:', visState)

await browser.close()
