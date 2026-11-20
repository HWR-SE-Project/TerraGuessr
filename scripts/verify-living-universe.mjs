import assert from 'node:assert/strict'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/living-universe'
const seconds = Number(process.env.OBSERVE_SECONDS || 90)
await mkdir(`${out}/raw`, { recursive: true })
const browser = await chromium.launch({ headless: process.env.QA_HEADLESS === '1' })
const report = { baseURL, errors: [], checks: {} }

async function open(options, stationary = false) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  await page.routeWebSocket('**/*', () => {})
  if (stationary) await (await context.newCDPSession(page)).send('Input.setIgnoreInputEvents', { ignore: true })
  page.on('pageerror', e => report.errors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) report.errors.push(m.text())
  })
  await page.goto(baseURL)
  await page.locator('[data-character-status="ready"]').waitFor({ timeout: 30000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
    window.__universeQA = (await import(url))._roots.get(document.querySelector('canvas')).store
    window.__universePointerEvents = 0
    window.addEventListener('pointermove', () => window.__universePointerEvents++)
    window.__universeFrames = []
    window.__universeStop = window.__universeQA.getState().internal.subscribe({ current: () => {
      window.__universeFrames.push(performance.now())
    } }, -2, window.__universeQA)
  })
  await page.waitForTimeout(1000)
  return { page, context }
}
const read = page => page.evaluate(() => {
  const s = window.__universeQA.getState()
  const env = s.scene.getObjectByName('home-cosmic-environment')
  const events = env.getObjectByName('cosmic-events')
  const stores = [...new Set(s.internal.subscribers.map(n => n.store))]
  const hud = stores.map(n => n.getState().scene).find(n => n.getObjectByName('home-explorer-fit'))
  const fit = hud.getObjectByName('home-explorer-fit')
  const planet = s.scene.children.find(n => n.type === 'Group' && n !== env)
  const gl = s.gl.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    wallTime: performance.now(), pointerEvents: window.__universePointerEvents,
    camera: [...s.camera.position.toArray(), ...s.camera.quaternion.toArray()],
    characterFit: [...fit.position.toArray(), ...fit.scale.toArray()],
    head: hud.getObjectByName('Head_06').quaternion.toArray(),
    planetFit: [...planet.position.toArray(), ...planet.scale.toArray()],
    layers: env.children.filter(o => o.isPoints).map(o => ({ name: o.name,
      count: o.geometry.attributes.position.count, geometry: o.geometry.uuid,
      time: o.material.uniforms.uTime.value, parallax: o.material.uniforms.uParallax.value.toArray(),
      driftSpeed: o.material.uniforms.uDriftSpeed.value,
      depthTest: o.material.depthTest, depthWrite: o.material.depthWrite,
    })),
    events: { ...events.userData, visible: events.visible,
      activeObjects: events.children.filter(n => n.visible).map(n => ({ name: n.name, position: n.position.toArray(), scale: n.scale.toArray() })) },
    overflow: document.documentElement.scrollWidth > innerWidth,
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
  }
})
const cadence = page => page.evaluate(() => {
  const a = window.__universeFrames
  const dt = a.slice(1).map((t, i) => t - a[i]).sort((a, b) => a - b)
  return { frames: a.length, fps: a.length < 2 ? 0 : +(1000 * (a.length - 1) / (a.at(-1) - a[0])).toFixed(1),
    p95IntervalMs: dt.length ? +dt[Math.floor(dt.length * 0.95)].toFixed(1) : 0 }
})
try {
  const desktop = await open({ viewport: { width: 1711, height: 864 },
    recordVideo: { dir: `${out}/raw`, size: { width: 1711, height: 864 } } }, true)
  const { page } = desktop
  const start = await read(page)
  await page.screenshot({ path: `${out}/desktop-1711x864.png` })
  assert.equal(start.layers.reduce((sum, l) => sum + l.count, 0), 10660)
  assert(start.layers.every(l => l.depthTest && !l.depthWrite))
  const captures = new Set()
  const observationStart = Date.now()
  const timeline = []
  while (Date.now() - observationStart < seconds * 1000) {
    await page.waitForTimeout(120)
    const snapshot = await read(page)
    assert.equal(snapshot.pointerEvents, 0)
    assert(snapshot.events.activeObjects.length <= 1)
    assert.deepEqual(snapshot.camera, start.camera)
    assert.deepEqual(snapshot.characterFit, start.characterFit)
    assert.deepEqual(snapshot.planetFit, start.planetFit)
    const active = snapshot.events.active
    if (active) {
      const progress = (snapshot.events.time - active.start) / active.duration
      if (!captures.has(active.kind) && progress >= 0.56 && progress <= 0.7) {
        await page.screenshot({ path: `${out}/${active.kind}-desktop.png` })
        captures.add(active.kind)
        timeline.push({ ...active, screenshotAt: snapshot.events.time,
          recordingSeconds: (Date.now() - observationStart) / 1000 + 2 })
        console.log(`Captured natural ${active.kind} at ${snapshot.events.time.toFixed(1)}s`)
      }
    }
  }
  const end = await read(page)
  assert(end.wallTime - start.wallTime >= 60000)
  assert.deepEqual([...captures].sort(), ['comet', 'meteor', 'satellite'])
  assert(end.layers[0].time - start.layers[0].time >= seconds * 0.85)
  assert.deepEqual(start.layers.map(l => l.geometry), end.layers.map(l => l.geometry))
  await page.screenshot({ path: `${out}/stationary-end.png` })
  report.checks.stationary = { seconds: (end.wallTime - start.wallTime) / 1000,
    pointerEvents: 0, cadence: await cadence(page), renderer: end.renderer,
    counts: end.events.counts, history: end.events.history, timeline, initial: start, final: end }
  const video = await page.video().path()
  await desktop.context.close()
  await rename(video, `${out}/stationary-90s.webm`)

  const interactive = await open({ viewport: { width: 1711, height: 864 } })
  await interactive.page.mouse.move(70, 140)
  await interactive.page.waitForTimeout(1700)
  const left = await read(interactive.page)
  await interactive.page.mouse.move(1640, 720)
  await interactive.page.waitForTimeout(1700)
  const right = await read(interactive.page)
  assert.deepEqual(left.camera, right.camera)
  assert.deepEqual(left.characterFit, right.characterFit)
  assert.deepEqual(left.planetFit, right.planetFit)
  assert(right.layers.every((l, i) => l.parallax[0] > left.layers[i].parallax[0] && l.time > left.layers[i].time))
  const headAngle = 2 * Math.acos(Math.min(1, Math.abs(left.head.reduce((sum, v, i) => sum + v * right.head[i], 0))))
  assert(headAngle > 0.05)
  report.checks.parallax = { headAngle, cameraAndModelAnchorsFixed: true, simultaneousDrift: true }
  await interactive.page.evaluate(() => { window.__universeFrames.length = 0 })
  for (let i = 0; i < 100; i++) {
    await interactive.page.mouse.move(600 + Math.sin(i / 10) * 300, 400 + Math.cos(i / 10) * 200)
    await interactive.page.waitForTimeout(16)
  }
  report.checks.interactiveCadence = await cadence(interactive.page)
  await interactive.page.emulateMedia({ reducedMotion: 'reduce' })
  await interactive.page.waitForTimeout(500)
  const reduceA = await read(interactive.page)
  await interactive.page.evaluate(() => { window.__universeFrames.length = 0 })
  await interactive.page.waitForTimeout(2200)
  const reduceB = await read(interactive.page)
  assert.deepEqual(reduceA.layers, reduceB.layers)
  assert.equal(reduceB.events.visible, false)
  assert.equal((await cadence(interactive.page)).frames, 0)
  await interactive.page.screenshot({ path: `${out}/reduced-motion.png` })
  report.checks.reducedMotion = { staticStars: true, transitsHidden: true, ongoingFrames: 0 }
  for (const width of [320, 375, 768, 1280, 1711]) {
    await interactive.page.setViewportSize({ width, height: 864 })
    await interactive.page.waitForTimeout(150)
    assert.equal((await read(interactive.page)).overflow, false)
  }
  report.checks.resize = [320, 375, 768, 1280, 1711]
  await interactive.context.close()

  const mobile = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true)
  const mStart = await read(mobile.page)
  const mobileStart = Date.now()
  let mobileEvent = false
  while (Date.now() - mobileStart < 22000) {
    await mobile.page.waitForTimeout(140)
    const s = await read(mobile.page)
    const event = s.events.active
    if (event && !mobileEvent && (s.events.time - event.start) / event.duration > 0.5) {
      await mobile.page.screenshot({ path: `${out}/meteor-mobile.png`, scale: 'css' })
      mobileEvent = true
    }
  }
  const mEnd = await read(mobile.page)
  assert(mEnd.layers.reduce((sum, l) => sum + l.count, 0) < 2000)
  assert(mEnd.layers.every(l => l.parallax.every(v => v === 0)))
  assert(mEnd.layers[0].time > mStart.layers[0].time + 18)
  assert.equal(mEnd.overflow, false)
  assert(mobileEvent)
  await mobile.page.screenshot({ path: `${out}/mobile-390x844.png`, scale: 'css' })
  report.checks.mobile = { cadence: await cadence(mobile.page), starCount: mEnd.layers.reduce((sum, l) => sum + l.count, 0),
    naturalMeteorObserved: mobileEvent, touchParallaxDisabled: true }
  await mobile.context.close()
  assert.deepEqual(report.errors, [])
} finally {
  await writeFile(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
