import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const output = 'docs/screenshots/multiplayer-redesign/after'
const choose = (page: Page, mode: 'Create' | 'Join') => page.getByRole('button', { name: `${mode} a lobby` }).click()

async function pasteCode(page: Page, text: string) {
  await page.getByLabel('Lobby code').evaluate((element, value) => {
    const data = new DataTransfer()
    data.setData('text/plain', value)
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test('intent first, exclusive flows, keyboard difficulty selection, all round counts and retained name', async ({ page }) => {
  await page.goto('/multiplayer')
  await expect(page.getByRole('heading', { name: 'Multiplayer', exact: true })).toBeVisible()
  await expect(page.locator('main input, main select, main form')).toHaveCount(0)
  await choose(page, 'Create')
  await page.getByLabel('Display name').fill('Explorer')
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const radio = page.getByRole('radio', { name: new RegExp(`^${difficulty}`) })
    await radio.check()
    await expect(radio).toBeChecked()
  }
  await page.getByRole('radio', { name: /^Easy/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: /^Medium/ })).toBeChecked()
  for (let rounds = 3; rounds <= 10; rounds++) {
    await page.getByLabel('Number of rounds').selectOption(String(rounds))
    await expect(page.getByLabel('Number of rounds')).toHaveValue(String(rounds))
  }
  await choose(page, 'Join')
  await expect(page.getByRole('group', { name: 'Difficulty' })).toHaveCount(0)
  await expect(page.getByLabel('Number of rounds')).toHaveCount(0)
  await expect(page.getByLabel('Display name')).toHaveValue('Explorer')
  await expect(page.locator('main form')).toHaveCount(1)
  await choose(page, 'Create')
  await expect(page.getByLabel('Display name')).toHaveValue('Explorer')
  await expect(page.getByRole('radio', { name: /^Medium/ })).toBeChecked()
  await expect(page.getByLabel('Number of rounds')).toHaveValue('10')
})

test('code normalization, complete paste, keyboard submit, inline validation and backend errors', async ({ page }) => {
  let requests = 0
  await page.route('**/api/lobbies/*/join', route => {
    requests++
    return route.fulfill({ status: 404, json: { error: { code: 'LOBBY_NOT_FOUND', message: 'That lobby could not be found. Check the code with your host.' } } })
  })
  await page.goto('/multiplayer')
  await choose(page, 'Join')
  const code = page.getByLabel('Lobby code')
  await page.getByRole('button', { name: 'Join lobby', exact: true }).click()
  await expect(code).toBeFocused()
  await expect(code).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toHaveText('Enter all 6 letters or numbers to join.')
  expect(requests).toBe(0)
  await code.fill('ab!2')
  await expect(code).toHaveValue('AB2')
  await code.press('Enter')
  expect(requests).toBe(0)
  await pasteCode(page, ' ab-c2 34! ')
  await expect(code).toHaveValue('ABC234')
  await code.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Check the code with your host.')
  expect(requests).toBe(1)
  await page.screenshot({ path: `${output}/join-error.png`, fullPage: true })
  await code.fill('ZZZ999')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const mode of ['Create', 'Join'] as const) {
  test(`${mode} loading prevents duplicate requests and permits retry after failure`, async ({ page }) => {
    let release!: () => void
    let seen!: () => void
    const requested = new Promise<void>(resolve => { seen = resolve })
    const pending = new Promise<void>(resolve => { release = resolve })
    let count = 0
    await page.route(mode === 'Create' ? '**/api/lobbies' : '**/api/lobbies/*/join', async route => {
      count++
      seen()
      await pending
      await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Please try again in a moment.' } } })
    })
    await page.goto('/multiplayer')
    await choose(page, mode)
    if (mode === 'Join') await page.getByLabel('Lobby code').fill('ABC234')
    await page.getByRole('button', { name: `${mode} lobby`, exact: true }).click()
    await requested
    await expect(page.getByRole('button', { name: mode === 'Create' ? 'Creating…' : 'Joining…' })).toBeDisabled()
    await expect(page.getByRole('button', { name: `${mode} a lobby` })).toBeDisabled()
    await expect(page.getByLabel('Display name')).toBeDisabled()
    expect(count).toBe(1)
    release()
    await expect(page.getByRole('alert')).toHaveText('Please try again in a moment.')
    await expect(page.getByRole('button', { name: `${mode} lobby`, exact: true })).toBeEnabled()
  })
}

test('profile name prefills without preventing edits or requiring authentication', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'test-user', displayName: 'Profile Explorer', email: 'explorer@example.com' } } }))
  await page.goto('/multiplayer')
  await choose(page, 'Create')
  await expect(page.getByLabel('Display name')).toHaveValue('Profile Explorer')
  await page.getByLabel('Display name').fill('Custom Explorer')
  await choose(page, 'Join')
  await expect(page.getByLabel('Display name')).toHaveValue('Custom Explorer')
})

test('default, Create and Join fit desktop viewports, mobile and enlarged layouts remain reachable', async ({ page }) => {
  test.setTimeout(90_000)
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const results: unknown[] = []
  for (const [width, height] of [[1920,1080], [1711,864], [1440,900], [1366,768], [1024,768], [768,1024], [390,844], [375,812], [320,568], [683,384]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/multiplayer')
    for (const mode of ['default', 'Create', 'Join'] as const) {
      if (mode !== 'default') await choose(page, mode)
      await expect(page.locator('.tl-choices')).toBeVisible()
      const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }))
      results.push({ mode, ...metrics })
      expect(metrics.scrollWidth).toBeLessThanOrEqual(width)
      if (width >= 1024) expect(metrics.scrollHeight).toBeLessThanOrEqual(height)
      for (const control of await page.locator('main button, main input, main select').all()) {
        await control.scrollIntoViewIfNeeded()
        const bounds = await control.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width).toBeGreaterThanOrEqual(14)
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        expect(await control.evaluate(el => {
          const r = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        })).toBe(true)
      }
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: `${output}/${mode.toLowerCase()}-${width}x${height}.png`, fullPage: true })
    }
  }
  await writeFile(`${output}/viewport-results.json`, JSON.stringify(results, null, 2))
})

test('live guests create, return, join in independent browsers and update membership', async ({ browser, baseURL }) => {
  test.setTimeout(90_000)
  const host = await browser.newContext({ baseURL })
  const guest = await browser.newContext({ baseURL })
  const page = await host.newPage()
  const friend = await guest.newPage()
  try {
    await page.goto('/multiplayer')
    await choose(page, 'Create')
    await page.getByRole('radio', { name: /^Easy/ }).check()
    await page.getByLabel('Number of rounds').selectOption('3')
    await page.getByLabel('Display name').fill('Lobby Host')
    await page.getByRole('button', { name: 'Create lobby', exact: true }).click()
    await expect(page.locator('.tl-code')).toBeVisible()
    const code = (await page.locator('.tl-code').innerText()).trim()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    await expect(page.getByRole('button', { name: 'Start match', exact: true })).toBeDisabled()
    await expect(page.locator('.tl-facts')).toContainText('easy')
    await expect(page.locator('.tl-facts > div').last().locator('dd')).toHaveText('3')
    await page.screenshot({ path: `${output}/live-created-lobby.png`, fullPage: true })
    await friend.goto('/multiplayer')
    // Exercise create → entry → join before joining the host's still-open room.
    await choose(friend, 'Create')
    await friend.getByRole('button', { name: 'Create lobby', exact: true }).click()
    await expect(friend.locator('.tl-code')).toBeVisible()
    await friend.getByRole('button', { name: 'Disband lobby' }).click()
    await expect(friend).toHaveURL(/\/multiplayer$/)
    await choose(friend, 'Join')
    await friend.getByLabel('Display name').fill('Lobby Friend')
    await pasteCode(friend, code.toLowerCase())
    await friend.getByLabel('Lobby code').press('Enter')
    await expect(friend.locator('.tl-code')).toHaveText(code)
    await expect(friend.locator('.tl-member')).toHaveCount(2)
    await expect(page.locator('.tl-member')).toHaveCount(2, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Start match', exact: true })).toBeEnabled()
    await expect(friend.getByRole('button', { name: 'Start match', exact: true })).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.tl-member')).toHaveCount(2)
    await page.screenshot({ path: `${output}/live-joined-lobby.png`, fullPage: true })
    await friend.getByRole('button', { name: 'Leave lobby', exact: true }).click()
    await expect(friend).toHaveURL(/\/multiplayer$/)
    await expect(page.locator('.tl-member')).toHaveCount(1, { timeout: 10_000 })
    await page.getByRole('button', { name: 'Disband lobby' }).click()
    await expect(page).toHaveURL(/\/multiplayer$/)
  } finally {
    await guest.close()
    await host.close()
  }
})

for (const width of [1711, 390]) {
  test(`shared navigation remains functional at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 864 })
    for (const [label, path] of [['TerraGuessr home', '/'], ['Singleplayer', '/game/singleplayer'], ['Settings', '/settings'], ['Sign in', '/auth'], ['How to Play / Tutorial', '/game/singleplayer?tutorial=1']]) {
      await page.goto('/multiplayer')
      if (width < 1200 && label !== 'TerraGuessr home' && label !== 'Sign in') await page.getByRole('button', { name: 'Open navigation' }).click()
      const active = page.getByRole('link', { name: 'Multiplayer', exact: true, includeHidden: true })
      await expect(active).toHaveAttribute('aria-current', 'page')
      await page.getByRole('link', { name: label, exact: true }).filter({ visible: true }).click()
      await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
    }
  })
}

test('invitation URL opens Join with the provided code', async ({ page }) => {
  await page.goto('/lobby/ABC234')
  await expect(page.getByRole('button', { name: 'Join a lobby' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByLabel('Lobby code')).toHaveValue('ABC234')
  await expect(page.getByRole('group', { name: 'Difficulty' })).toHaveCount(0)
})
