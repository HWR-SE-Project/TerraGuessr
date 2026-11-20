import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Run an unmodified reference checkout separately; the current Home markup must
// match if other tasks have made unrelated UI edits in the shared workspace.
const referenceURL = process.env.HOME_REFERENCE_URL
if (!referenceURL) throw new Error('Set HOME_REFERENCE_URL to the pre-extraction Home server')
const currentURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const out = 'docs/screenshots/shared-cosmic'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { method: 'Same reduced-motion camera, star buffers, shader uniforms and DOM anchors; exact GPU pixels including the original avatar HUD pass.',
  note: 'A concurrent workspace change moved Edit Avatar upward by 15px. Both reference and current scene use that current Home markup.' }
try {
  for (const [name, viewport] of [['desktop', { width: 1711, height: 864 }], ['mobile', { width: 390, height: 844 }]]) {
    const states = [], images = []
    for (const [label, url] of [['reference', referenceURL], ['shared', currentURL]]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1,
        ...(name === 'mobile' ? { isMobile: true, hasTouch: true } : {}) })
      const page = await context.newPage()
      await page.goto(url)
      await page.locator('[data-character-status="ready"]').waitFor({ timeout: 60000 })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(1200)
      const data = await page.evaluate(async () => {
        const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/@react-three_fiber.js'))
        const s = (await import(url))._roots.get(document.querySelector('canvas')).store.getState()
        const state = { size: s.size, camera: [...s.camera.position.toArray(), ...s.camera.quaternion.toArray()],
          layers: s.scene.getObjectByName('home-cosmic-environment').children.filter(o => o.isPoints).map(o => ({
            name: o.name, positions: Array.from(o.geometry.attributes.position.array),
            uniforms: Object.fromEntries(Object.entries(o.material.uniforms).map(([k, u]) => [k, u.value.toArray ? u.value.toArray() : u.value])),
          })), anchors: ['.th-character-slot', '.th-edit-avatar', '.th-game-modes'].map(q => document.querySelector(q).getBoundingClientRect().toJSON()) }
        const hud = [...new Set(s.internal.subscribers.map(n => n.store))].map(store => store.getState()).find(v => v.scene.getObjectByName('home-explorer-fit'))
        // Reproduce Drei's existing two-pass draw, then read immediately before
        // the browser clears the non-preserved drawing buffer.
        s.gl.autoClear = true
        s.gl.render(s.scene, s.camera)
        s.gl.autoClear = false
        s.gl.clearDepth()
        s.gl.render(hud.scene, hud.camera)
        s.gl.autoClear = true
        return { state, png: s.gl.domElement.toDataURL('image/png').split(',')[1] }
      })
      states.push(data.state)
      const png = Buffer.from(data.png, 'base64')
      images.push(png)
      await writeFile(`${out}/home-${label}-scene-${name}.png`, png)
      await context.close()
    }
    assert.deepEqual(states[0], states[1])
    report[name] = { viewport, cameraBuffersUniformsAndAnchorsIdentical: true, gpuPixelsIdentical: images[0].equals(images[1]) }
    assert(report[name].gpuPixelsIdentical, 'Reference and extracted scene pixels must match')
    console.log(name, report[name])
  }
} finally {
  await browser.close()
  await writeFile(`${out}/home-equivalence.json`, JSON.stringify(report, null, 2) + '\n')
}
