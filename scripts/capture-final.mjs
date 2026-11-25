// Final comprehensive capture for v2 review. Run: node scripts/capture-final.mjs
import { chromium } from '@playwright/test'
const BASE = 'http://localhost:8080'
const OUT = 'docs/screenshots-v2'
const b = await chromium.launch()

async function shot(p, n) {
  await p.screenshot({ path: `${OUT}/${n}.png` })
  console.log('✓', n)
}
async function go(p, path) {
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(800)
}

// Singleplayer easy flow + round result + session summary (desktop)
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  await go(p, '/singleplayer')
  await p.getByRole('radio', { name: /Easy/ }).click()
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await p.waitForTimeout(3200)
  await shot(p, 'sp-game-easy-desktop')
  const city = p.locator('button').filter({ has: p.locator('span.block.truncate.font-bold') })
  await city.first().click()
  await p.getByRole('button', { name: 'Submit guess' }).click()
  await p.waitForTimeout(700)
  await p.getByRole('button', { name: 'Final' }).click()
  await p.waitForTimeout(1800)
  await shot(p, 'sp-round-result-desktop')
  await p.getByRole('button', { name: /Next round/ }).click()
  await p.waitForTimeout(2500)
  await shot(p, 'sp-round2-desktop')
  // End session → summary
  await p.getByRole('button', { name: 'Leave game' }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'End session' }).click()
  await p.waitForTimeout(1200)
  await shot(p, 'sp-session-summary-desktop')
  await c.close()
}

// Singleplayer hard (map) mode — desktop
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  await go(p, '/singleplayer')
  await p.getByRole('radio', { name: /Hard/ }).click()
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await p.waitForTimeout(3200)
  await shot(p, 'sp-game-hard-desktop')
  await c.close()
}

// Mobile singleplayer game
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 } })
  const p = await c.newPage()
  await go(p, '/singleplayer')
  await p.getByRole('radio', { name: /Medium/ }).click()
  await p.getByRole('button', { name: 'Start exploring' }).click()
  await p.waitForTimeout(3200)
  await shot(p, 'sp-game-mobile')
  await c.close()
}

// Multiplayer full flow: create → waiting → start → game
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  await go(p, '/multiplayer?mode=create')
  await p.getByRole('button', { name: 'Create lobby' }).click()
  await p.waitForTimeout(1800)
  await shot(p, 'mp-lobby-waiting-desktop')
  await p.getByRole('button', { name: /Start match/ }).click()
  await p.waitForTimeout(3200)
  await shot(p, 'mp-game-desktop')
  await c.close()
}

// Multiplayer mobile hub
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 } })
  const p = await c.newPage()
  await go(p, '/multiplayer')
  await shot(p, 'mp-hub-mobile')
  await c.close()
}

await b.close()
console.log('done')
