import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.CHARACTER_BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch()
const results = { url: base, pageErrors: [], consoleErrors: [], directions: {}, responsive: [] }
const context = await browser.newContext({ viewport: { width: 1711, height: 864 } })
const page = await context.newPage()
page.on('pageerror', error => results.pageErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') results.consoleErrors.push(message.text()) })

// Read the actual R3F objects and hook resources; no production debug globals,
// replacement model, mocked animation or screenshot-specific route is required.
async function installInspector(page) {
  await page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js')
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')
    const THREE = await import('/node_modules/three/build/three.module.js')
    const reference = await new GLTFLoader().loadAsync('/src/assets/home/scene/puppet-kid.glb')
    const referenceMixer = new THREE.AnimationMixer(reference.scene)
    referenceMixer.clipAction(reference.animations.find(clip => clip.name === 'Idle')).play()
    window.inspectCharacter = () => {
      let instance, rig, gaze, animation
      const root = [..._roots.values()][0]
      const walk = node => {
        if (!node) return
        if (node.stateNode?.object?.name === 'home-explorer-motion') instance = node.stateNode
        for (let hook = node.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState
          if (Array.isArray(value) && value[0]?.headBase) rig = value[0]
          if (Array.isArray(value) && value[0]?.actions && value[0]?.mixer) animation = value[0]
          if (value?.current && typeof value.current.yaw === 'number') gaze = value.current
        }
        walk(node.child); walk(node.sibling)
      }
      walk(root.fiber.current)
      if (!instance || !rig || !animation || !gaze) throw Error('Actual character rig not mounted')
      const motion = instance.object
      const model = motion.children[0]
      referenceMixer.setTime(animation.actions.Idle.time)
      const changedBones = []
      const skeletons = new Set(), materials = new Set()
      model.traverse(node => { if (node.isSkinnedMesh) skeletons.add(node.skeleton); if (node.isMesh) materials.add(node.material) })
      model.traverse(node => {
        if (!node.isBone) return
        const original = reference.scene.getObjectByName(node.name)
        const angle = node.quaternion.clone().normalize().angleTo(original.quaternion.clone().normalize())
        if (angle > 0.0001) changedBones.push({ name: node.name, angle })
      })
      model.updateWorldMatrix(true, true)
      model.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update() })
      const bounds = new THREE.Box3().setFromObject(model, true)
      const camera = instance.root.getState().camera
      const canvas = root.store.getState().gl.domElement.getBoundingClientRect()
      const projected = []
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera)
        projected.push({ x: canvas.left + (p.x + 1) * canvas.width / 2, y: canvas.top + (1 - p.y) * canvas.height / 2 })
      }
      const info = root.store.getState().gl.info
      return {
        yaw: gaze.yaw, pitch: gaze.pitch, changedBones, skeletons: skeletons.size, materials: materials.size, uniformScale: motion.parent.scale.toArray(),
        bodyQuaternion: motion.quaternion.toArray(), bodyPosition: motion.position.toArray(),
        actionTime: animation.actions.Idle.time, mixerTime: animation.mixer.time,
        headQuaternion: rig.head.quaternion.toArray(), neckQuaternion: rig.neck.quaternion.toArray(),
        frame: info.render.frame, drawCalls: info.render.calls, triangles: info.render.triangles,
        textures: info.memory.textures, geometries: info.memory.geometries,
        bounds: { left: Math.min(...projected.map(p => p.x)), right: Math.max(...projected.map(p => p.x)), top: Math.min(...projected.map(p => p.y)), bottom: Math.max(...projected.map(p => p.y)) },
      }
    }
  })
}
const inspect = () => page.evaluate(() => window.inspectCharacter())
const settle = () => page.waitForTimeout(1450)
const leave = async () => {
  await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: null, pointerType: 'mouse' })))
  await settle()
}
try {
  await page.goto(base)
  await page.locator('[data-character-status="ready"]').waitFor()
  await installInspector(page)
  for (const [name, x, y] of [['left', 1, 440], ['right', 1710, 440], ['up', 855, 1], ['down', 855, 863]]) {
    await page.mouse.move(x, y)
    await settle()
    const state = await inspect()
    assert(Math.abs(state.yaw) <= Math.PI / 6 + 0.001)
    assert(Math.abs(state.pitch) <= Math.PI / 12 + 0.001)
    assert.equal(state.skeletons, 1)
    assert.equal(state.materials, 2)
    assert.deepEqual(state.bodyQuaternion, [0, 0, 0, 1])
    assert.deepEqual(state.bodyPosition, [0, 0, 0])
    assert(state.changedBones.every(bone => ['Head_06', 'Neck_05'].includes(bone.name)), JSON.stringify(state.changedBones))
    if (name === 'left') assert(state.yaw < -0.4)
    if (name === 'right') assert(state.yaw > 0.4)
    if (name === 'up') assert(state.pitch < -0.2)
    if (name === 'down') assert(state.pitch > 0.2)
    results.directions[name] = state
    await page.screenshot({ path: path.join(out, `tracking-${name}.png`) })
    console.log(`PASS ${name}: yaw ${(state.yaw * 180 / Math.PI).toFixed(1)}°, pitch ${(state.pitch * 180 / Math.PI).toFixed(1)}°; only head/neck differ from original Idle`)
  }
  await page.mouse.move(1, 440); await settle()
  await page.mouse.move(1710, 440)
  await page.waitForTimeout(80)
  const during = await inspect()
  assert(during.yaw < 0.48, 'Rotation must interpolate instead of snapping')
  await settle()
  const settled = await inspect()
  await page.waitForTimeout(500)
  const stable = await inspect()
  assert(Math.abs(stable.yaw - settled.yaw) < 0.03)
  assert.notEqual(stable.actionTime, settled.actionTime, 'Embedded idle must continue during gaze')
  results.smoothing = { during: during.yaw, settled: settled.yaw, stable: stable.yaw }
  await leave()
  const neutral = await inspect()
  assert(Math.abs(neutral.yaw) < 0.002 && Math.abs(neutral.pitch) < 0.002)
  results.returnToNeutral = neutral
  await page.screenshot({ path: path.join(out, 'home-1711x864.png') })
  await page.screenshot({ path: path.join(out, 'character-closeup.png'), clip: { x: 735, y: 341, width: 240, height: 343 }, scale: 'css' })
  await page.mouse.move(100, 300)
  const frameStart = await inspect()
  await page.waitForTimeout(700)
  const frameEnd = await inspect()
  assert.equal(frameStart.textures, frameEnd.textures)
  assert.equal(frameStart.geometries, frameEnd.geometries)
  results.performance = { activeFramesPerSecond: (frameEnd.frame - frameStart.frame) / 2 / 0.7, ...frameEnd }
  for (const [width, height] of [[1711, 864], [1920, 1080], [1280, 800], [768, 1024], [390, 844], [375, 812], [320, 864]]) {
    await page.setViewportSize({ width, height })
    await leave()
    const state = await inspect()
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
      return { description: rect('.th-description'), button: rect('.th-edit-avatar'), cards: rect('.th-game-modes'), heading: rect('h1'), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert(!layout.overflow)
    assert(state.bounds.top > layout.description.bottom + 3, `Text overlap at ${width}: ${JSON.stringify(state.bounds)}`)
    assert(state.bounds.bottom < layout.button.top - 2, `Button overlap at ${width}`)
    assert(state.bounds.left >= 0 && state.bounds.right <= width)
    assert(Math.abs((state.bounds.left + state.bounds.right) / 2 - width / 2) < 20)
    results.responsive.push({ width, height, bounds: state.bounds, layout })
    await page.screenshot({ path: path.join(out, `home-${width}x${height}.png`) })
    console.log(`PASS composition ${width}×${height}`)
  }
  await page.setViewportSize({width:1711,height:864})
  await page.mouse.move(1, 400); await settle()
  await page.emulateMedia({ reducedMotion: 'reduce' }); await settle()
  const reduced = await inspect()
  await page.mouse.move(1710, 1); await page.waitForTimeout(400)
  const reducedLater = await inspect()
  assert.equal(reducedLater.yaw, 0); assert.equal(reducedLater.pitch, 0)
  assert.equal(reduced.actionTime, reducedLater.actionTime)
  assert.deepEqual(reduced.headQuaternion, reducedLater.headQuaternion)
  results.reducedMotion = { passed: true, framesAfterPointer: reducedLater.frame - reduced.frame }
  await page.screenshot({ path: path.join(out, 'reduced-motion.png') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const edit = page.getByRole('button', { name: 'Edit Avatar' })
  await edit.click(); assert(await page.getByRole('dialog').isVisible())
  await page.keyboard.press('Escape'); await page.waitForTimeout(100)
  assert(await edit.evaluate(button => button === document.activeElement))
  results.editAvatar = 'dialog, Escape dismissal and focus restoration passed'
  const mobile = await browser.newContext({ viewport: { width:390,height:844 }, isMobile:true, hasTouch:true })
  const mobilePage = await mobile.newPage()
  await mobilePage.goto(base); await mobilePage.locator('[data-character-status="ready"]').waitFor()
  await installInspector(mobilePage)
  await mobilePage.touchscreen.tap(20, 400); await mobilePage.waitForTimeout(500)
  const mobileState = await mobilePage.evaluate(() => window.inspectCharacter())
  assert.equal(mobileState.yaw, 0); assert.equal(mobileState.pitch, 0)
  assert.equal(mobileState.changedBones.length, 0)
  await mobilePage.screenshot({ path: path.join(out, 'mobile-touch-390x844.png') })
  results.touch = 'neutral gaze, original idle preserved'
  await mobile.close()
  const failed = await browser.newContext({ viewport: { width:1711,height:864 } })
  const failurePage = await failed.newPage()
  await failurePage.route('**/puppet-kid.glb*', route => new URL(route.request().url()).search ? route.continue() : route.abort())
  await failurePage.goto(base)
  await failurePage.locator('[data-character-status="error"]').waitFor()
  assert(await failurePage.getByText('Avatar unavailable', { exact:true }).isVisible())
  assert(await failurePage.getByRole('heading', {name:'Explore the World'}).isVisible())
  assert(await failurePage.getByRole('link', {name:'Play Solo Challenge yourself'}).isVisible())
  assert.equal(await failurePage.locator('canvas').count(),1)
  await failurePage.screenshot({ path: path.join(out, 'asset-failure.png') })
  results.assetFailure = 'explicit unavailable message; Earth, navigation and game cards retained'
  await failed.close()
  const unsupported = await browser.newContext({ viewport: { width:390,height:844 } })
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args)
    }
  })
  const unsupportedPage = await unsupported.newPage()
  await unsupportedPage.goto(base)
  await unsupportedPage.locator('[data-character-status="error"]').waitFor()
  assert.equal(await unsupportedPage.locator('canvas').count(), 0)
  assert(await unsupportedPage.locator('.th-earth img').isVisible())
  assert(await unsupportedPage.getByText('Avatar unavailable', { exact:true }).isVisible())
  await unsupportedPage.screenshot({ path:path.join(out, 'no-webgl.png') })
  results.noWebGL = 'static Earth and honest avatar unavailable message; controls retained'
  await unsupported.close()
  assert.equal(results.pageErrors.length, 0, JSON.stringify(results.pageErrors))
  assert.equal(results.consoleErrors.length, 0, JSON.stringify(results.consoleErrors))
  results.passed = true
  console.log('PASS all browser verification')
} finally {
  await fs.writeFile(path.join(out, 'verification.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
