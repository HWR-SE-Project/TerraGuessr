import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/cosmic'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: process.env.QA_HEADLESS === '1' })
const report = { baseURL, errors: [], apiFailures: [], checks: {} }

// Inspect the live development R3F store without shipping debug hooks in the app.
async function open(context) {
  const page = await context.newPage()
  page.on('pageerror', e => report.errors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text())
  })
  page.on('response', r => {
    if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/api/'))
      report.apiFailures.push({ path: new URL(r.url()).pathname, status: r.status() })
  })
  await page.goto(baseURL)
  await page.locator('[data-character-status="ready"]').waitFor({ timeout: 30000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const url = performance.getEntriesByType('resource').map(e => e.name)
      .find(u => u.includes('/@react-three_fiber.js'))
    const { _roots } = await import(url)
    window.__cosmicQA = _roots.get(document.querySelector('canvas')).store
  })
  await page.waitForTimeout(1000)
  return page
}

async function snapshot(page) {
  return page.evaluate(() => {
    const s = window.__cosmicQA.getState()
    const environment = s.scene.getObjectByName('home-cosmic-environment')
    const layers = environment.children.filter(n => n.isPoints)
    const stores = [...new Set(s.internal.subscribers.map(n => n.store))]
    const hud = stores.map(n => n.getState().scene).find(n => n.getObjectByName('home-explorer-fit'))
    const head = hud?.getObjectByName('Head_06')
    const fit = hud?.getObjectByName('home-explorer-fit')
    const planet = s.scene.children.find(n => n.type === 'Group' && n !== environment)
    const context = s.gl.getContext()
    const debug = context.getExtension('WEBGL_debug_renderer_info')
    return {
      camera: [...s.camera.position.toArray(), ...s.camera.quaternion.toArray()],
      layers: layers.map(n => ({ name: n.name, count: n.geometry.attributes.position.count,
        time: n.material.uniforms.uTime.value, offset: n.material.uniforms.uParallax.value.toArray(),
        depthTest: n.material.depthTest, depthWrite: n.material.depthWrite,
        nearestZ: Math.max(...Array.from(n.geometry.attributes.position.array).filter((_, i) => i % 3 === 2)),
      })),
      head: head?.quaternion.toArray(), fit: fit ? [...fit.position.toArray(), ...fit.scale.toArray()] : null,
      planetPosition: planet?.position.toArray(),
      dpr: s.gl.getPixelRatio(),
      overflow: document.documentElement.scrollWidth > innerWidth,
      renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown',
      quietRect: layers[0].material.uniforms.uQuietRect.value.toArray(),
    }
  })
}

async function cadence(page, tracking) {
  await page.evaluate(() => {
    const store = window.__cosmicQA
    window.__cosmicTimes = []
    window.__cosmicUnsubscribe = store.getState().internal.subscribe({ current: () => {
      window.__cosmicTimes.push(performance.now())
    } }, -2, store)
  })
  if (tracking) {
    for (let i = 0; i < 100; i++) {
      await page.mouse.move(500 + Math.sin(i / 8) * 300, 450 + Math.cos(i / 8) * 200)
      await page.waitForTimeout(16)
    }
  } else await page.waitForTimeout(3200)
  return page.evaluate(() => {
    window.__cosmicUnsubscribe()
    const times = window.__cosmicTimes
    const intervals = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b)
    if (times.length < 2) return { renderedFrames: times.length, fps: 0, p95FrameIntervalMs: 0 }
    return { renderedFrames: times.length,
      fps: +(1000 * (times.length - 1) / (times.at(-1) - times[0])).toFixed(1),
      p95FrameIntervalMs: +intervals[Math.floor(intervals.length * 0.95)].toFixed(1) }
  })
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  const page = await open(desktop)
  await page.screenshot({ path: `${out}/desktop-1711x864.png` })
  const start = await snapshot(page)
  assert.equal(start.layers.reduce((sum, n) => sum + n.count, 0), 3315)
  assert(start.layers.every(n => n.depthTest && !n.depthWrite && n.nearestZ < -10))
  assert.equal(start.overflow, false)
  await page.mouse.move(100, 150)
  await page.waitForTimeout(1400)
  const left = await snapshot(page)
  await page.screenshot({ path: `${out}/parallax-left.png` })
  await page.mouse.move(1600, 730)
  await page.waitForTimeout(1400)
  const right = await snapshot(page)
  await page.screenshot({ path: `${out}/parallax-right.png` })
  assert.deepEqual(left.camera, right.camera)
  assert.deepEqual(left.fit, right.fit)
  assert.deepEqual(left.planetPosition, right.planetPosition)
  const headAngle = 2 * Math.acos(Math.min(1, Math.abs(left.head.reduce((sum, v, i) => sum + v * right.head[i], 0))))
  report.checks.headTracking = { left: left.head, right: right.head, angleRadians: headAngle }
  assert(headAngle > 0.05, 'Head tracking must still respond')
  assert(right.layers[2].offset[0] > left.layers[2].offset[0])
  const farShift = Math.abs(right.layers[0].offset[0] - left.layers[0].offset[0]) / 104
  const nearShift = Math.abs(right.layers[2].offset[0] - left.layers[2].offset[0]) / 26
  assert(nearShift > farShift * 6, 'Near stars must have stronger apparent parallax')
  report.checks.desktop = { start, left, right, nearToFarParallaxRatio: +(nearShift / farShift).toFixed(2) }
  await page.mouse.move(855, 850)
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${out}/animation-a.png` })
  const animationA = await snapshot(page)
  await page.waitForTimeout(4500)
  await page.screenshot({ path: `${out}/animation-b.png` })
  const animationB = await snapshot(page)
  assert(animationB.layers[0].time > animationA.layers[0].time + 2)
  report.checks.idleCadence = await cadence(page, false)
  report.checks.trackingCadence = await cadence(page, true)

  // Count actual environment draw calls in the existing render pass.
  report.checks.drawCalls = await page.evaluate(async () => {
    const s = window.__cosmicQA.getState()
    const original = s.gl.render
    return await new Promise(resolve => {
      s.gl.render = function (scene, camera) {
        original.call(this, scene, camera)
        if (scene !== s.scene) return
        const full = this.info.render.calls
        const env = s.scene.getObjectByName('home-cosmic-environment')
        env.visible = false
        original.call(this, scene, camera)
        const withoutEnvironment = this.info.render.calls
        env.visible = true
        original.call(this, scene, camera)
        this.render = original
        resolve({ mainPass: full, withoutEnvironment, environment: full - withoutEnvironment })
      }
      s.invalidate()
    })
  })
  assert.equal(report.checks.drawCalls.environment, 5)
  await page.getByRole('button', { name: 'Edit Avatar' }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  assert(await page.getByRole('button', { name: 'Edit Avatar' }).evaluate(e => e === document.activeElement))
  report.checks.editAvatar = true

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(800)
  const reducedA = await snapshot(page)
  await page.screenshot({ path: `${out}/reduced-motion.png` })
  await page.mouse.move(60, 70)
  await page.waitForTimeout(1800)
  const reducedB = await snapshot(page)
  assert.deepEqual(reducedA, reducedB)
  report.checks.reducedMotion = { static: true, stopped: await cadence(page, false) }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(500)
  assert((await snapshot(page)).layers[0].time > reducedB.layers[0].time)
  report.checks.motionResumes = true

  for (const width of [320, 375, 768, 1280, 1711]) {
    await page.setViewportSize({ width, height: 864 })
    await page.waitForTimeout(180)
    assert.equal((await snapshot(page)).overflow, false)
  }
  report.checks.resize = [320, 375, 768, 1280, 1711]
  await desktop.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const mp = await open(mobile)
  await mp.screenshot({ path: `${out}/mobile-390x844.png`, scale: 'css' })
  const mobileA = await snapshot(mp)
  await mp.touchscreen.tap(35, 410)
  await mp.waitForTimeout(600)
  const mobileB = await snapshot(mp)
  assert(mobileA.layers.reduce((sum, n) => sum + n.count, 0) < 800)
  assert(mobileB.layers.every(n => n.offset.every(v => v === 0)))
  assert.equal(mobileB.overflow, false)
  report.checks.mobile = mobileB
  await mobile.close()

  const lowPower = await browser.newContext({ viewport: { width: 1711, height: 864 } })
  await lowPower.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }))
  const lp = await open(lowPower)
  const low = await snapshot(lp)
  assert(low.layers.reduce((sum, n) => sum + n.count, 0) < 1400)
  report.checks.lowPower = low
  await lowPower.close()
  assert.deepEqual(report.errors, [])
} finally {
  await writeFile(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
