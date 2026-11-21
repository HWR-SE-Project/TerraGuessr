import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 375, height: 812 })
await page.goto('http://localhost:8080/how-to-play')
await page.waitForTimeout(500)
const data = await page.evaluate(() => {
  const p = document.querySelector('.htp-multiplayer')
  const links = [...p.querySelectorAll('a')]
  return links.map(a => ({
    text: a.textContent,
    boundingRect: a.getBoundingClientRect().toJSON(),
    clientRects: [...a.getClientRects()].map(r => r.toJSON()),
  }))
})
console.log(JSON.stringify(data, null, 2))
await page.screenshot({ path: '/tmp/htp-375.png', fullPage: true })
await browser.close()
