import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/cosmic-motion'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: process.env.QA_HEADLESS === '1' })
const report = { baseURL, errors: [], checks: {} }
const read = page => page.evaluate(() => {
  const s = window.__motionQA.getState()
  const env = s.scene.getObjectByName('home-cosmic-environment')
  const layers = env.children.filter(o => o.isPoints)
  const stores = [...new Set(s.internal.subscribers.map(n => n.store))]
  const hud = stores.map(n => n.getState().scene).find(n => n.getObjectByName('home-explorer-fit'))
  const fit = hud.getObjectByName('home-explorer-fit')
  const head = hud.getObjectByName('Head_06')
  return {
    wallTime: performance.now(), pointerEvents: window.__motionPointerEvents,
    camera: [...s.camera.position.toArray(), ...s.camera.quaternion.toArray()],
    fit: [...fit.position.toArray(), ...fit.scale.toArray()], head: head.quaternion.toArray(),
    layers: layers.map(o => {
      const u = o.material.uniforms
      const t = u.uTime.value
      const phase = o.geometry.attributes.aPhase.array
      const positions = o.geometry.attributes.position.array
      const drift = u.uDriftAmplitude.value
      const offsets = Array.from({ length: Math.min(100, phase.length / 3) }, (_, i) => {
        const x = phase[i * 3], y = phase[i * 3 + 1], z = phase[i * 3 + 2]
        const rate = (0.015 + z * 0.025) * u.uDriftSpeed.value
        // Sample the shader's projected displacement independently of pointer input.
        const pixelsPerWorldUnit = s.size.height / (2 * Math.tan(Math.PI / 12) * (10 - positions[i * 3 + 2]))
        return [(Math.sin(t * rate + x) - Math.sin(x)) * drift.x * pixelsPerWorldUnit,
          (Math.cos(t * rate * (0.67 + z * 0.35) + y) - Math.cos(y)) * drift.y * pixelsPerWorldUnit]
      })
      return { name: o.name, geometry: o.geometry.uuid, count: o.geometry.attributes.position.count,
        time: t, parallax: u.uParallax.value.toArray(), drift: drift.toArray(), offsets }
    }),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }
})

async function open(options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  // Keep one loaded scene stable while other workspace edits may trigger Vite HMR.
  await page.routeWebSocket('**/*', () => {})
  // Isolate the stationary recording from physical mouse movement on this workstation.
  if (options.recordVideo) await (await context.newCDPSession(page)).send('Input.setIgnoreInputEvents', { ignore: true })
  page.on('pageerror', e => report.errors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) report.errors.push(m.text())
  })
  await page.goto(baseURL)
  await page.locator('[data-character-status="ready"]').waitFor({ timeout: 30000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
    const { _roots } = await import(url)
    window.__motionQA = _roots.get(document.querySelector('canvas')).store
    window.__motionPointerEvents = 0
    window.addEventListener('pointermove', () => window.__motionPointerEvents++)
    window.__motionFrames = []
    window.__motionStop = window.__motionQA.getState().internal.subscribe({ current: () => window.__motionFrames.push(performance.now()) }, -2, window.__motionQA)
  })
  await page.waitForTimeout(1000)
  return { context, page }
}
const fps = page => page.evaluate(() => {
  const a = window.__motionFrames
  return a.length < 2 ? 0 : +(1000 * (a.length - 1) / (a.at(-1) - a[0])).toFixed(1)
})

try {
  const { page, context } = await open({ viewport: { width: 1711, height: 864 },
    recordVideo: { dir: `${out}/raw`, size: { width: 1711, height: 864 } } })
  const samples = []
  for (let i = 0; i < 5; i++) {
    if (i) await page.waitForTimeout(8000)
    samples.push(await read(page))
    await page.screenshot({ path: `${out}/stationary-${i * 8}s.png` })
    console.log(`Stationary observation: ${i * 8}s, pointer events: ${samples.at(-1).pointerEvents}`)
  }
  assert(samples.at(-1).wallTime - samples[0].wallTime >= 32000)
  assert(samples.every(s => s.pointerEvents === 0 && s.layers.every(l => l.parallax.every(n => n === 0))))
  const displacement = samples[0].layers.map((layer, i) => {
    const last = samples.at(-1).layers[i]
    assert.equal(layer.geometry, last.geometry)
    assert(last.time - layer.time > 28)
    return { layer: layer.name, count: layer.count,
      meanMovementPixels: +(last.offsets.reduce((sum, p, j) => sum + Math.hypot(p[0] - layer.offsets[j][0], p[1] - layer.offsets[j][1]), 0) / last.offsets.length).toFixed(3) }
  })
  assert(displacement[2].meanMovementPixels > displacement[1].meanMovementPixels)
  assert(displacement[1].meanMovementPixels > displacement[0].meanMovementPixels)
  report.checks.stationary = { observedSeconds: (samples.at(-1).wallTime - samples[0].wallTime) / 1000,
    pointerEvents: 0, fps: await fps(page), displacement, stableGeometry: true }
  const video = page.video()
  // End this capture before pointer interaction; the video demonstrates autonomous motion only.
  const recordingPath = await video.path()
  await context.close()
  await rename(recordingPath, `${out}/stationary-32s.webm`)

  const desktop = await open({ viewport: { width: 1711, height: 864 } })
  await desktop.page.mouse.move(80, 150)
  await desktop.page.waitForTimeout(1600)
  const left = await read(desktop.page)
  await desktop.page.mouse.move(1630, 720)
  await desktop.page.waitForTimeout(1600)
  const right = await read(desktop.page)
  assert.deepEqual(left.camera, right.camera)
  assert.deepEqual(left.fit, right.fit)
  assert(right.layers.every((l, i) => l.parallax[0] > left.layers[i].parallax[0] && l.time > left.layers[i].time))
  const headAngle = 2 * Math.acos(Math.min(1, Math.abs(left.head.reduce((sum, v, i) => sum + v * right.head[i], 0))))
  assert(headAngle > 0.05)
  report.checks.parallax = { simultaneousDrift: true, fixedCameraAndCharacterAnchor: true, headAngle }

  await desktop.page.emulateMedia({ reducedMotion: 'reduce' })
  await desktop.page.waitForTimeout(500)
  const reducedA = await read(desktop.page)
  await desktop.page.evaluate(() => { window.__motionFrames.length = 0 })
  const originalAppearance = await desktop.page.evaluate(() => {
    const s = window.__motionQA.getState()
    const points = s.scene.getObjectByName('home-cosmic-environment').children.filter(o => o.isPoints)
    return points.map(o => o.material.vertexShader)
  })
  await desktop.page.evaluate(() => {
    const s = window.__motionQA.getState()
    s.scene.getObjectByName('home-cosmic-environment').children.filter(o => o.isPoints).forEach(o => {
      o.material.vertexShader = o.material.vertexShader.replace(/\/\/ Independent,[\s\S]*?p\.xy \+= origin[^;]*;/,
        'p.xy += vec2(sin(uTime * 0.018 + aPhase.x), cos(uTime * 0.012 + aPhase.y)) * 0.055;')
      o.material.needsUpdate = true
    })
    s.invalidate()
  })
  await desktop.page.waitForTimeout(250)
  await desktop.page.screenshot({ path: `${out}/static-original.png` })
  await desktop.page.evaluate(shaders => {
    const s = window.__motionQA.getState()
    s.scene.getObjectByName('home-cosmic-environment').children.filter(o => o.isPoints).forEach((o, i) => {
      o.material.vertexShader = shaders[i]
      o.material.needsUpdate = true
    })
    s.invalidate()
  }, originalAppearance)
  await desktop.page.waitForTimeout(250)
  await desktop.page.screenshot({ path: `${out}/static-current.png` })
  // Browser compositing can dither dark gradients by 1–2 RGB levels between captures.
  const appearanceMaxDifference = Number(execFileSync('python3', ['-c',
    'from PIL import Image, ImageChops; import sys; d=ImageChops.difference(Image.open(sys.argv[1]).convert("RGB"), Image.open(sys.argv[2]).convert("RGB")); print(max(v for _, v in d.getextrema()))',
    `${out}/static-original.png`, `${out}/static-current.png`], { encoding: 'utf8' }).trim())
  assert(appearanceMaxDifference <= 2, 'Original and new static appearance must match within compositing precision')
  await desktop.page.evaluate(() => { window.__motionFrames.length = 0 })
  await desktop.page.waitForTimeout(2000)
  const reducedB = await read(desktop.page)
  assert.deepEqual(reducedA.layers, reducedB.layers)
  assert.equal(await fps(desktop.page), 0)
  report.checks.reducedMotion = { static: true, fps: 0, originalAppearanceMaxChannelDifference: appearanceMaxDifference }
  await desktop.context.close()

  const mobile = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const mobileA = await read(mobile.page)
  await mobile.page.waitForTimeout(4000)
  const mobileB = await read(mobile.page)
  assert(mobileB.layers[0].time > mobileA.layers[0].time + 3)
  assert(mobileB.layers.every(l => l.parallax.every(v => v === 0)))
  assert.equal(mobileB.overflow, false)
  await mobile.page.screenshot({ path: `${out}/mobile-390x844.png`, scale: 'css' })
  report.checks.mobile = { fps: await fps(mobile.page), continuousDrift: true,
    particleCount: mobileB.layers.reduce((sum, l) => sum + l.count, 0), touchParallaxDisabled: true }
  await mobile.context.close()
  assert.deepEqual(report.errors, [])
} finally {
  await writeFile(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
