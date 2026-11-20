import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/shared-cosmic'
await mkdir(out, { recursive: true })
const report = { baseURL, errors: [], checks: {}, screenshots: [] }
const browser = await chromium.launch({ headless: process.env.QA_HEADLESS === '1' })

async function attach(page) {
  await page.waitForFunction(() => document.querySelector('.cosmic-background[data-ready="true"] canvas'))
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
    window.__cosmicQA = (await import(url))._roots.get(document.querySelector('.cosmic-background canvas')).store
    window.__cosmicCanvas = document.querySelector('.cosmic-background canvas')
    window.__cosmicFrames = []
    window.__cosmicStop = window.__cosmicQA.getState().internal.subscribe({ current: () => window.__cosmicFrames.push(performance.now()) }, -2, window.__cosmicQA)
  })
}
const read = page => page.evaluate(() => {
  const s = window.__cosmicQA.getState()
  const env = s.scene.getObjectByName('home-cosmic-environment')
  const events = env.getObjectByName('cosmic-events')
  const frames = window.__cosmicFrames
  const intervals = frames.slice(1).map((v, i) => v - frames[i]).sort((a, b) => a - b)
  return {
    canvasCount: document.querySelectorAll('.cosmic-background canvas').length,
    persistentCanvas: document.querySelector('.cosmic-background canvas') === window.__cosmicCanvas,
    enabled: document.querySelector('.cosmic-background').dataset.enabled,
    visibility: getComputedStyle(document.querySelector('.cosmic-background')).visibility,
    pointerEvents: getComputedStyle(document.querySelector('.cosmic-background')).pointerEvents,
    overflow: document.documentElement.scrollWidth > innerWidth,
    size: s.size, camera: [...s.camera.position.toArray(), ...s.camera.quaternion.toArray()],
    layers: env.children.filter(o => o.isPoints).map(o => ({ name: o.name, count: o.geometry.attributes.position.count,
      geometry: o.geometry.uuid, time: o.material.uniforms.uTime.value,
      parallax: o.material.uniforms.uParallax.value.toArray(),
      quiet: o.material.uniforms.uQuietRect.value.toArray(), face: o.material.uniforms.uFaceRect.value.toArray() })),
    events: { ...events.userData, visible: events.visible, activeObjects: events.children.filter(o => o.visible).length },
    memory: { ...s.gl.info.memory, programs: s.gl.info.programs.length },
    cadence: { frames: frames.length, fps: frames.length < 2 ? 0 : +(1000 * (frames.length - 1) / (frames.at(-1) - frames[0])).toFixed(1),
      p95IntervalMs: intervals.length ? +intervals[Math.floor(intervals.length * 0.95)].toFixed(1) : 0 },
  }
})
async function navigate(page, path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
  await page.waitForTimeout(550)
  await page.evaluate(() => document.fonts.ready)
}
async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, scale: 'css' })
  report.screenshots.push(`${name}.png`)
}
async function open(options = {}) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message.replace(/AIza[\w-]+/g, '[REDACTED]')))
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) report.errors.push(message.text()) })
  await page.goto(baseURL)
  await page.locator('[data-character-status="ready"]').waitFor({ timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  await attach(page)
  return { page, context }
}
async function expedition(page, suffix) {
  await navigate(page, '/game/singleplayer')
  const waitPanorama = async () => {
    for (let retry = 0; retry < 3; retry++) {
      await page.waitForFunction(() => document.querySelector('.sp-panorama[data-ready="true"]') || [...document.querySelectorAll('button')].some(b => b.textContent === 'Try another location'), null, { timeout: 50000 })
      if (await page.locator('.sp-panorama[data-ready="true"]').count()) return
      await page.getByRole('button', { name: 'Try another location', exact: true }).click()
    }
    throw new Error('Live Street View panorama unavailable after retries')
  }
  for (let number = 1; number <= 5; number++) {
    await waitPanorama()
    const active = await read(page)
    assert.equal(active.enabled, 'false')
    assert.equal(active.visibility, 'hidden')
    if (number === 1) {
      await page.evaluate(() => { window.__cosmicFrames.length = 0 })
      await page.waitForTimeout(1200)
      assert.equal((await read(page)).cadence.frames, 0)
      await shot(page, `gameplay-${suffix}`)
      report.checks[`streetView-${suffix}`] = { skyHidden: true, cosmicFrames: 0, mapAndIntelligencePresent:
        await page.getByRole('complementary', { name: 'Guessing map' }).count() === 1 && await page.locator('.gi-panel').count() === 1 }
    }
    const expand = page.getByRole('button', { name: 'Expand map', exact: true })
    if (await expand.isVisible()) await expand.click()
    await page.mouse.move(500, 100)
    const map = page.locator('.sp-guess-panel .sp-google-map')
    await map.locator('img').first().waitFor()
    await map.click({ position: { x: 180, y: 110 } })
    await page.getByRole('button', { name: 'Guess', exact: true }).click()
    await page.getByRole('region', { name: 'Round results', exact: true }).waitFor()
    assert.equal((await read(page)).enabled, 'true')
    if (number === 1) { await page.waitForTimeout(500); await shot(page, `round-results-${suffix}`) }
    await page.getByRole('button', { name: number === 5 ? 'View final results' : 'Next round' }).click()
  }
  await page.getByRole('region', { name: 'Final results', exact: true }).waitFor()
  await page.waitForTimeout(500)
  await shot(page, `final-results-${suffix}`)
  assert.equal((await read(page)).enabled, 'true')
  await page.getByRole('button', { name: 'Return home', exact: true }).click()
  await page.locator('[data-character-status="ready"]').waitFor()
}
try {
  const { page, context } = await open({ viewport: { width: 1711, height: 864 } })
  const start = await read(page)
  assert.equal(start.layers.reduce((sum, l) => sum + l.count, 0), 10660)
  await shot(page, 'home-desktop')
  const routes = [['auth', '/auth'], ['duels', '/duels'], ['settings-guest', '/settings'], ['reset-password', '/reset-password'], ['weather-setup', '/play'], ['daily', '/daily']]
  for (const [name, path] of routes) {
    await navigate(page, path)
    const s = await read(page)
    assert.equal(s.canvasCount, 1); assert(s.persistentCanvas); assert(!s.overflow); assert.equal(s.pointerEvents, 'none')
    await shot(page, `${name}-desktop`)
  }
  // Use the existing backend to create a real friend challenge, with no fixture UI.
  const challenge = await page.evaluate(async () => {
    const game = await fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'solo', difficulty: 'medium', roundsTotal: 3 }) }).then(r => r.json())
    const round = await fetch(`/api/games/${game.gameId}/rounds`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player-Token': game.playerToken }, body: JSON.stringify({ selectionMode: 'map' }) }).then(r => r.json())
    return await fetch('/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player-Token': game.playerToken }, body: JSON.stringify({ roundId: round.roundId }) }).then(r => r.json())
  })
  if (challenge.challengeId) { routes.push(['friend-challenge', `/challenge/${challenge.challengeId}`]); await navigate(page, routes.at(-1)[1]); await shot(page, 'friend-challenge-desktop') }
  await expedition(page, 'desktop')
  const memories = []
  for (let i = 0; i < 12; i++) {
    await navigate(page, ['/duels', '/auth', '/settings', '/play'][i % 4])
    const s = await read(page)
    assert.equal(s.canvasCount, 1); assert(s.persistentCanvas)
    assert(s.events.time >= start.events.time)
    memories.push({ route: new URL(page.url()).pathname, ...s.memory, time: s.layers[0].time })
  }
  await navigate(page, '/duels')
  const stableA = await read(page)
  await page.waitForTimeout(2500)
  const stableB = await read(page)
  assert.deepEqual(stableA.layers.map(l => l.geometry), stableB.layers.map(l => l.geometry))
  assert(stableB.layers[0].time > stableA.layers[0].time + 2)
  await page.mouse.move(70, 150); await page.waitForTimeout(1500); const left = await read(page)
  await page.mouse.move(1630, 730); await page.waitForTimeout(1500); const right = await read(page)
  assert(right.layers.every((l, i) => l.parallax[0] > left.layers[i].parallax[0]))
  assert.deepEqual(left.camera, right.camera)
  report.checks.persistence = { navigationCount: 22, sameCanvas: true, autonomousMotion: true, parallax: true, memories }
  // Observe natural scheduler events; do not accelerate clocks or inject transits.
  const captured = new Set()
  const deadline = Date.now() + 100000
  while (Date.now() < deadline && captured.size < 3) {
    const s = await read(page)
    assert(s.events.activeObjects <= 1)
    const active = s.events.active
    if (active && !captured.has(active.kind) && (s.events.time - active.start) / active.duration > 0.55) {
      await shot(page, `${active.kind}-duels-desktop`)
      captured.add(active.kind)
      console.log('Observed natural', active.kind)
    }
    await page.waitForTimeout(300)
  }
  assert.deepEqual([...captured].sort(), ['comet', 'meteor', 'satellite'])
  report.checks.events = { natural: [...captured], ...(await read(page)).events }
  await page.evaluate(() => { window.__cosmicFrames.length = 0 })
  await page.waitForTimeout(3000)
  report.checks.desktopPerformance = (await read(page)).cadence
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(500)
  const reducedA = await read(page)
  await page.evaluate(() => { window.__cosmicFrames.length = 0 })
  await page.waitForTimeout(2000)
  const reducedB = await read(page)
  assert.deepEqual(reducedA.layers, reducedB.layers); assert(!reducedB.events.visible); assert.equal(reducedB.cadence.frames, 0)
  report.checks.reducedMotion = { staticStars: true, transitsHidden: true, frames: 0 }
  await shot(page, 'reduced-motion-desktop')
  // Visibility uses the same lifecycle event delivered by the browser when a tab is hidden.
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(500)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(300)
  await page.evaluate(() => { window.__cosmicFrames.length = 0 })
  await page.waitForTimeout(1500)
  assert.equal((await read(page)).cadence.frames, 0)
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(1000)
  assert((await read(page)).cadence.frames > 0)
  report.checks.hiddenTab = { framesWhileHidden: 0, resumes: true, method: 'visibility lifecycle event' }
  await context.close()

  const mobile = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await shot(mobile.page, 'home-mobile')
  for (const [name, path] of routes) { await navigate(mobile.page, path); assert(!(await read(mobile.page)).overflow); await shot(mobile.page, `${name}-mobile`) }
  await expedition(mobile.page, 'mobile')
  await mobile.page.evaluate(() => { window.__cosmicFrames.length = 0 })
  await mobile.page.waitForTimeout(3000)
  const m = await read(mobile.page)
  assert(m.layers.reduce((sum, l) => sum + l.count, 0) < 2000)
  assert(m.layers.every(l => l.parallax.every(v => v === 0)))
  report.checks.mobile = { starCount: m.layers.reduce((sum, l) => sum + l.count, 0), touchParallaxDisabled: true, cadence: m.cadence }
  await mobile.context.close()
  assert.deepEqual(report.errors, [])
} finally {
  await writeFile(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report.checks, null, 2))
