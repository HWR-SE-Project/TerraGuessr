import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tutorial = (page: Page) => page.getByRole('dialog', { name: 'How to play / Tutorial' })
const subjects = ['Weather', 'Location', 'Confirmation', 'Distance', 'Points']
async function step(page: Page, number: number) {
  await tutorial(page).getByRole('button', { name: `Step ${number}: ${subjects[number - 1]}` }).click()
}
const round = { id: 'r14-round', number: 2, panoId: 'test-only-panorama' }
const preserved = { id: 'r14-game', playerToken: 'test-only-token' }
const session = { id: preserved.id, difficulty: 'hard', totalScore: 4200, activeRound: round, results: [] }
async function isolateProviders(page: Page, available = false) {
  // Explicit offline/provider doubles. Real Google imagery is verified separately in tutorial.live.spec.ts.
  await page.route('**/maps.googleapis.com/maps/api/js?*', route => route.abort())
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available, provider: 'google', serverKeyConfigured: available } }))
}
async function open(page: Page, difficulty = 'medium') {
  await page.addInitScript(difficulty => localStorage.setItem('terraguessr.difficulty.v1', difficulty), difficulty)
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole('button', { name: 'How to Play / Tutorial' }).click()
  await expect(tutorial(page)).toBeVisible()
}

test('R14: home main-menu entry opens the guide without starting a game', async ({ page }) => {
  await isolateProviders(page)
  const mutations: string[] = []
  page.on('request', request => { if (request.url().includes('/api/singleplayer/') && request.method() !== 'GET') mutations.push(request.url()) })
  await page.goto('/')
  await page.getByRole('link', { name: 'How to Play / Tutorial' }).click()
  await expect(tutorial(page)).toBeVisible()
  await expect(tutorial(page).getByText('STEP 1 OF 5 · MEDIUM')).toBeVisible()
  for (const label of ['Temperature (°C)', 'Precipitation (mm)', 'Humidity (%)', 'Wind speed (m/s)']) {
    const indicator = tutorial(page).getByRole('button', { name: label })
    await indicator.click()
    await expect(indicator).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(tutorial(page).getByText(/Clues, not proof/)).toBeVisible()
  await expect(tutorial(page).getByText('Tutorial example · weather, not your current round')).toBeVisible()
  expect(mutations).toEqual([])
})

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`R14: ${difficulty} selection, changes, confirmation and restart`, async ({ page }) => {
    await isolateProviders(page)
    await open(page, difficulty)
    await step(page, 3)
    const confirm = tutorial(page).getByRole('button', { name: 'Confirm practice guess' })
    await expect(confirm).toBeDisabled()
    if (difficulty === 'easy') {
      const options = tutorial(page).getByTestId('candidate-option')
      await expect(options).toHaveCount(4)
      await options.nth(0).click()
      await options.nth(1).click()
      await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'false')
      await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true')
    } else {
      await step(page, 2)
      await expect(tutorial(page).getByText(difficulty === 'hard' ? /no country borders/ : /includes country borders/)).toBeVisible()
      await tutorial(page).getByRole('img', { name: 'Offline coordinate practice grid' }).click({ position: { x: 120, y: 80 } })
      await tutorial(page).getByLabel('Practice latitude').fill('42')
      await tutorial(page).getByLabel('Practice longitude').fill('12')
      await step(page, 3)
    }
    await expect(tutorial(page).getByRole('status')).toContainText('Selection changed. Still not submitted.')
    await confirm.click()
    await expect(tutorial(page).getByRole('status')).toContainText('answer is locked')
    await expect(confirm).toBeDisabled()
    await tutorial(page).getByRole('button', { name: 'Restart tutorial' }).click()
    await expect(tutorial(page).getByText(`STEP 1 OF 5 · ${difficulty.toUpperCase()}`)).toBeVisible()
    await step(page, 3)
    await expect(confirm).toBeDisabled()
  })
}

test('R14: Haversine result, true scoring curve and finishing', async ({ page }) => {
  await isolateProviders(page)
  await open(page)
  await step(page, 4)
  await expect(tutorial(page).getByText('Tutorial example · London → Paris')).toBeVisible()
  await expect(tutorial(page).locator('.tt-distance')).toContainText('343.6 km')
  await expect(tutorial(page).getByRole('img', { name: /markers connected by a line/ })).toBeVisible()
  await tutorial(page).getByText('Explore the Haversine formula').click()
  await expect(tutorial(page).getByText(/R = 6371.0088 km/)).toBeVisible()
  await expect(tutorial(page).getByText('one decimal place')).toBeVisible()
  await step(page, 5)
  await expect(tutorial(page).getByText(/TerraGuessr is endless/)).toBeVisible()
  const slider = tutorial(page).getByRole('slider')
  for (const [distance, score] of [['0', '5,000'], ['2000', '1,839'], ['20000', '0']]) {
    await slider.fill(distance!)
    await expect(tutorial(page).getByLabel('Example score')).toContainText(score!)
  }
  await tutorial(page).getByRole('button', { name: 'Finish tutorial' }).click()
  await expect(tutorial(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Game menu', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(tutorial(page).getByText('STEP 1 OF 5 · MEDIUM')).toBeVisible()
})

test('R14: exit at every step preserves the active round, score, difficulty and panorama (no resume involved)', async ({ page }) => {
  await isolateProviders(page, true)
  await page.route('**/api/singleplayer/games', route => route.fulfill({ status: 201, json: preserved }))
  await page.route('**/api/singleplayer/games/r14-game', route => route.fulfill({ json: session }))
  await page.route('**/api/singleplayer/games/r14-game/rounds', route => route.fulfill({ status: 201, json: round }))
  await page.route('**/api/singleplayer/games/r14-game/rounds/*/intelligence', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Offline' } } }))
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/ }).click()
  await expect(tutorial(page)).toBeVisible() // starting a brand-new game opens the guide automatically
  await tutorial(page).getByRole('button', { name: 'Skip' }).click()
  await expect(tutorial(page)).toHaveCount(0)
  const panorama = await page.locator('.sp-panorama').elementHandle()
  // Only track mutations from here: starting the game itself legitimately
  // issues a create + first-round POST.
  const mutations: string[] = []
  page.on('request', request => { if (request.url().includes('/api/singleplayer/') && request.method() !== 'GET') mutations.push(request.url()) })
  for (let number = 1; number <= 5; number++) {
    await page.getByRole('button', { name: 'Game menu' }).click()
    await page.getByRole('button', { name: 'How to Play / Tutorial' }).click()
    await expect(tutorial(page).getByText('STEP 1 OF 5 · HARD')).toBeVisible()
    await step(page, 3)
    await tutorial(page).getByLabel('Practice latitude').fill('42')
    await tutorial(page).getByRole('button', { name: 'Confirm practice guess' }).click()
    await step(page, number)
    await tutorial(page).getByRole('button', { name: 'Restart tutorial' }).click()
    await expect(tutorial(page).getByText('STEP 1 OF 5 · HARD')).toBeVisible()
    await step(page, number)
    if (number % 2) await page.keyboard.press('Escape')
    else await tutorial(page).getByRole('button', { name: 'Skip' }).click()
    await expect(tutorial(page)).toHaveCount(0)
    await expect(page.locator('.sp-hud')).toContainText('4,200')
    expect(await panorama!.evaluate(element => element.isConnected)).toBe(true)
  }
  expect(mutations).toEqual([])
})

test('R14: temporary always-show starts on new games even after completion or skip', async ({ page }) => {
  await isolateProviders(page, true)
  let creates = 0
  await page.addInitScript(() => localStorage.setItem('terraguessr.tutorialSeen.v1', '1'))
  await page.route('**/api/singleplayer/games', async route => { creates++; await route.fulfill({ status: 201, json: preserved }) })
  await page.route('**/api/singleplayer/games/r14-game', route => route.fulfill({ json: session }))
  await page.route('**/api/singleplayer/games/r14-game/rounds', route => route.fulfill({ status: 201, json: round }))
  await page.route('**/api/singleplayer/games/r14-game/rounds/*/intelligence', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Offline' } } }))
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/ }).click()
  await expect(tutorial(page)).toBeVisible()
  await expect.poll(() => creates).toBe(1)
  await tutorial(page).getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole('button', { name: 'Restart game' }).click()
  await page.getByRole('dialog', { name: 'Start a new expedition?' }).getByRole('button', { name: 'Restart game' }).click()
  await expect(tutorial(page)).toBeVisible()
  await expect.poll(() => creates).toBe(2)
})

test('R14: mobile, tablet, narrow zoom-sized viewport and keyboard focus remain usable', async ({ page }) => {
  await isolateProviders(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  for (const width of [320, 390, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 720 })
    for (let number = 1; number <= 5; number++) {
      await step(page, number)
      expect(await tutorial(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      const next = tutorial(page).getByRole('button', { name: number === 5 ? 'Finish tutorial' : 'Next', exact: true })
      await next.scrollIntoViewIfNeeded()
      await expect(next).toBeInViewport()
      await expect(tutorial(page).getByRole('button', { name: 'Skip' })).toBeInViewport()
    }
  }
  await tutorial(page).getByRole('button', { name: 'Restart tutorial' }).click()
  await tutorial(page).getByRole('button', { name: 'Restart tutorial' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(tutorial(page).getByRole('button', { name: 'Next', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(tutorial(page).getByRole('button', { name: 'Restart tutorial' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Game menu', exact: true })).toBeFocused()
})


test('R14: actual Chromium browser zoom at 200% keeps every step reachable', async ({ baseURL }) => {
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-r14-zoom-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL, args: ['--window-size=1280,900'],
  })
  try {
    const page = await context.newPage()
    // A disposable full Chromium profile lets us exercise browser zoom, not CSS scaling or pinch zoom.
    await page.goto('chrome://settings/appearance')
    await page.locator('#zoomLevel').selectOption({ label: '200%' })
    await isolateProviders(page)
    await open(page)
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2)
    expect(await page.evaluate(() => innerWidth)).toBeLessThanOrEqual(640)
    for (let number = 1; number <= 5; number++) {
      await step(page, number)
      expect(await tutorial(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      const next = tutorial(page).getByRole('button', { name: number === 5 ? 'Finish tutorial' : 'Next', exact: true })
      await next.scrollIntoViewIfNeeded()
      await expect(next).toBeInViewport()
      await expect(tutorial(page).getByRole('button', { name: 'Skip' })).toBeInViewport()
    }
    await tutorial(page).getByRole('button', { name: 'Finish tutorial' }).click()
    await expect(tutorial(page)).toHaveCount(0)
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})
