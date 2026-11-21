import { expect, test, type Page } from '@playwright/test'

const API = process.env.AVATAR_TEST_API_URL
const KEY = 'terraguessr.avatar.guest.v1'
const empty = { version: 1, hairColor: null, eyeColor: null, shirtColor: null, pantsColor: null, shoeColor: null }

// Inspect the actual R3F model and its live shader bindings in the Vite browser.
// No test hooks or globals are shipped in the application.
async function rendered(page: Page, preview = true, capturePixels = false) {
  return page.evaluate(async ({ preview, capturePixels }) => {
    const url = '/node_modules/.vite/deps/@react-three_fiber.js'
    const { _roots } = await import(/* @vite-ignore */ url)
    for (const [canvas, root] of _roots) {
      if (!!canvas.closest('.ae-canvas') !== preview) continue
      let model: any = null
      let mixer: any = null
      const walk = (fiber: any) => {
        if (!fiber) return
        if (fiber.memoizedProps?.object?.getObjectByName?.('Head_06')) model = fiber.memoizedProps.object
        for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) {
          const state = hook.memoizedState
          if (state?.constructor?.name === 'AnimationMixer') mixer = state
        }
        walk(fiber.child); walk(fiber.sibling)
      }
      walk(root.fiber.current)
      if (!model) continue
      const colors: Record<string, { enabled: number; color: string }> = {}
      const geometry: Record<string, string> = {}
      model.traverse((node: any) => {
        if (!node.isMesh) return
        geometry[node.name] = node.geometry.uuid
        if (!node.material.customProgramCacheKey().startsWith('avatar-tint')) return
        const shader: any = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>' }
        node.material.onBeforeCompile(shader, root.store.getState().gl)
        colors[node.name] = { enabled: shader.uniforms.avatarEnabled.value, color: shader.uniforms.avatarColor.value.getHexString() }
      })
      const state = root.store.getState()
      let pixels: number[] = []
      if (preview && capturePixels) {
        state.gl.render(state.scene, state.camera)
        const context = state.gl.getContext()
        const data = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4)
        context.readPixels(0, 0, context.drawingBufferWidth, context.drawingBufferHeight, context.RGBA, context.UNSIGNED_BYTE, data)
        // Every 13th pixel is enough to verify the actual rendered appearance.
        let checksum = 0
        let visible = 0
        for (let i = 0; i < data.length; i += 52) {
          checksum = (Math.imul(checksum, 31) + data[i] + data[i + 1] * 257 + data[i + 2] * 65537) | 0
          if (data[i + 3]) visible++
        }
        pixels = [checksum, visible]
      }
      const head = model.getObjectByName('Head_06')
      const spine = model.getObjectByName('Spine1_03')
      return { colors, geometry, pixels, camera: state.camera.position.toArray(),
        head: head.quaternion.toArray(), spine: spine.quaternion.toArray(),
        animationTime: mixer?.time ?? 0, clips: mixer?._actions.map((action: any) => ({ name: action._clip.name, running: action.isRunning() })) ?? [] }
    }
    throw new Error('Actual GLB avatar is not mounted')
  }, { preview, capturePixels })
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Edit Avatar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled({ timeout: 30_000 })
}
async function home(page: Page) {
  await page.goto('/')
  await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15_000)
  if (API) await page.route('**/api/**', async route => {
    const original = new URL(route.request().url())
    if (!original.pathname.startsWith('/api/')) return route.continue()
    const response = await route.fetch({ url: `${API}${original.pathname}${original.search}` })
    await route.fulfill({ response })
  })
})

test('actual model colors, cancel, save, reload, reset and keyboard focus', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await home(page)
  const originalHome = await rendered(page, false)
  await open(page)
  const original = await rendered(page, true, true)
  expect(original.colors.Object_50.enabled).toBe(0)
  await page.getByRole('button', { name: 'Hair & brows Lilac', exact: true }).click()
  await expect.poll(async () => (await rendered(page)).colors.Object_50).toEqual({ enabled: 1, color: 'a58bd7' })
  const hair = await rendered(page, true, true)
  expect(hair.pixels).not.toEqual(original.pixels)
  expect(hair.colors.Object_44).toEqual(hair.colors.Object_50)
  expect(hair.geometry).toEqual(original.geometry)
  await page.getByRole('button', { name: 'Face', exact: true }).click()
  await page.getByRole('button', { name: 'Eyes Ocean', exact: true }).click()
  await expect.poll(async () => (await rendered(page)).colors.Object_47.color).toBe('378bce')
  const eyes = await rendered(page, true, true)
  expect(eyes.pixels).not.toEqual(hair.pixels)
  await page.getByRole('button', { name: 'Outfit', exact: true }).click()
  await page.getByRole('button', { name: 'Shirt Coral', exact: true }).click()
  await page.getByRole('button', { name: 'Shorts Midnight', exact: true }).click()
  await page.getByRole('button', { name: 'Slippers Forest', exact: true }).click()
  const outfit = await rendered(page, true, true)
  expect(outfit.colors.Object_59).toEqual({ enabled: 1, color: 'e67b58' })
  expect(outfit.colors.Object_62.color).toBe('333b67')
  expect(outfit.colors.Object_56.color).toBe('388365')
  expect(outfit.pixels).not.toEqual(eyes.pixels)
  await page.screenshot({ path: 'docs/screenshots/avatar/editor-desktop.png' })
  // A draft must not leak onto the separate Home model or shared GLTF materials.
  expect((await rendered(page, false)).colors).toEqual(originalHome.colors)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit Avatar' })).toBeFocused()
  expect((await rendered(page, false)).colors).toEqual(originalHome.colors)
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull()
  await open(page)
  await page.getByRole('button', { name: 'Hair & brows Lilac', exact: true }).click()
  await page.getByRole('button', { name: 'Outfit', exact: true }).click()
  await page.getByRole('button', { name: 'Shirt Coral', exact: true }).click()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Avatar saved on this device.' })).toBeVisible()
  const savedHome = await rendered(page, false)
  expect(savedHome.colors.Object_50).toEqual({ enabled: 1, color: 'a58bd7' })
  expect(savedHome.colors.Object_59.color).toBe('e67b58')
  expect(savedHome.geometry).toEqual(originalHome.geometry)
  await page.reload()
  await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready')
  expect((await rendered(page, false)).colors).toEqual(savedHome.colors)
  await open(page)
  await expect(page.getByRole('button', { name: 'Hair & brows Lilac', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Reset to Default' }).click()
  expect((await rendered(page)).colors.Object_50.enabled).toBe(0)
  expect((await rendered(page, false)).colors).toEqual(savedHome.colors)
  await page.keyboard.press('Escape')
  await open(page)
  expect((await rendered(page)).colors.Object_50.color).toBe('a58bd7')
  await page.getByRole('button', { name: 'Reset to Default' }).click()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  expect((await rendered(page, false)).colors.Object_50.enabled).toBe(0)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY)).toEqual(empty)
  await open(page)
  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true)
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('camera rotation, zoom, original idle and Home head tracking survive editing', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await home(page)
  const before = await rendered(page, false)
  await expect.poll(async () => (await rendered(page, false)).animationTime).toBeGreaterThan(before.animationTime)
  expect((await rendered(page, false)).clips).toContainEqual({ name: 'Idle', running: true })
  await open(page)
  const preview = await rendered(page)
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  await expect.poll(async () => (await rendered(page)).camera[0]).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const closer = await rendered(page)
  expect(Math.hypot(...closer.camera)).toBeLessThan(Math.hypot(...preview.camera))
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await expect.poll(async () => Math.abs((await rendered(page)).camera[0])).toBeLessThan(.01)
  const box = (await page.locator('.ae-canvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 12 }); await page.mouse.up()
  await expect.poll(async () => Math.abs((await rendered(page)).camera[0])).toBeGreaterThan(.3)
  await expect.poll(async () => (await rendered(page)).animationTime).toBeGreaterThan(preview.animationTime)
  expect((await rendered(page)).clips).toContainEqual({ name: 'Idle', running: true })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const after = await rendered(page, false)
  expect(after.animationTime).toBeGreaterThan(before.animationTime)
  expect(after.geometry).toEqual(before.geometry)
  await page.mouse.move(50, 280)
  await page.waitForTimeout(600)
  const left = await rendered(page, false)
  await page.mouse.move(1350, 280)
  await page.waitForTimeout(600)
  const right = await rendered(page, false)
  expect(Math.abs(right.head[1] - left.head[1])).toBeGreaterThan(.03)
})

for (const [width, height] of [[390, 844], [768, 1024], [640, 450]]) {
  test(`responsive editor and accessible actions ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await home(page)
    await open(page)
    await page.getByRole('button', { name: 'Outfit', exact: true }).click()
    await page.getByRole('button', { name: 'Slippers Ocean', exact: true }).click()
    expect((await rendered(page)).colors.Object_56.color).toBe('378bce')
    const dialog = page.getByRole('dialog')
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    for (const name of ['Save Changes', 'Cancel', 'Reset to Default']) {
      const action = page.getByRole('button', { name, exact: true })
      await action.scrollIntoViewIfNeeded()
      await expect(action).toBeInViewport()
      expect(await action.evaluate(el => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return hit === el || el.contains(hit)
      })).toBe(true)
    }
    await page.getByRole('button', { name: 'Hair', exact: true }).click()
    await page.getByRole('button', { name: 'Hair & brows Honey', exact: true }).click()
    expect((await rendered(page)).colors.Object_50.color).toBe('d9ab57')
    await dialog.evaluate(el => { el.scrollTo(0, 0); el.querySelector('.ae-body')?.scrollTo(0, 0) })
    await page.screenshot({ path: `docs/screenshots/avatar/editor-${width}x${height}.png` })
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await open(page)
    expect((await rendered(page)).colors.Object_50.color).toBe('d9ab57')
  })
}

test('account synchronization, sign-in restoration, failures and guest isolation', async ({ page }) => {
  test.skip(!API, 'Set AVATAR_TEST_API_URL to an isolated running backend with migrated Postgres')
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const email = `avatar-browser-${Date.now()}@example.test`
  const password = 'correct horse battery'
  const registration = await page.request.post(`${API}/api/auth/register`, { data: { email, password, displayName: 'Avatar Tester' } })
  expect(registration.ok()).toBe(true)
  expect((await registration.json()).verificationRequired).toBe(false)
  await home(page)
  await open(page)
  await page.getByRole('button', { name: 'Hair & brows Forest', exact: true }).click()
  await page.route('**/api/auth/avatar', async route => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Test outage' } } })
    else await route.fallback()
  })
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not sync')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect((await rendered(page)).colors.Object_50.color).toBe('388365')
  expect((await rendered(page, false)).colors.Object_50.enabled).toBe(0)
  await page.unroute('**/api/auth/avatar')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await page.request.get(`${API}/api/auth/avatar`)).ok()).toBe(true)
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull()
  await page.request.post(`${API}/api/auth/logout`)
  await page.reload()
  await open(page)
  expect((await rendered(page)).colors.Object_50.enabled).toBe(0)
  await page.keyboard.press('Escape')
  expect((await page.request.post(`${API}/api/auth/login`, { data: { email, password } })).ok()).toBe(true)
  await page.reload()
  await open(page)
  expect((await rendered(page)).colors.Object_50).toEqual({ enabled: 1, color: '388365' })
  await page.keyboard.press('Escape')
  await page.route('**/api/auth/avatar', route => route.fulfill({ status: 503, json: {} }))
  await page.reload()
  await page.getByRole('button', { name: 'Edit Avatar' }).click()
  await expect(page.getByRole('alert')).toContainText('could not be loaded')
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled()
  await page.unroute('**/api/auth/avatar')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled({ timeout: 30_000 })
  expect((await rendered(page)).colors.Object_50.color).toBe('388365')
})

test.describe('touch preview', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  test('touch drag rotates the model and keyboard selects a genuine color', async ({ page }) => {
    test.setTimeout(90_000)
    await home(page)
    await open(page)
    const first = await rendered(page)
    const box = (await page.locator('.ae-canvas').boundingBox())!
    const session = await page.context().newCDPSession(page)
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] })
    for (let offset = 10; offset <= 70; offset += 10) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + offset, y: startY }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => Math.abs((await rendered(page)).camera[0] - first.camera[0])).toBeGreaterThan(.3)
    await page.getByRole('button', { name: 'Hair & brows Rose', exact: true }).focus()
    await page.keyboard.press('Space')
    await expect.poll(async () => (await rendered(page)).colors.Object_50.color).toBe('db769d')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect((await rendered(page, false)).colors.Object_50.color).toBe('db769d')
  })
})
