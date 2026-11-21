import { chromium, expect, test, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tutorial = (page: Page) => page.getByRole('dialog', { name: 'How to play / Tutorial' })
async function isolateProviders(page: Page, available = false) {
  await page.route('**/maps.googleapis.com/maps/api/js?*', route => route.abort())
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available, provider: 'google', serverKeyConfigured: available } }))
}
async function open(page: Page) {
  await page.goto('/game/singleplayer?tutorial=1')
  await expect(tutorial(page)).toBeVisible()
}
const round = { id: 'r14-round', number: 2, panoId: 'test-only-panorama' }
const preserved = { id: 'r14-game', playerToken: 'test-only-token' }
const session = { id: preserved.id, difficulty: 'hard', totalScore: 4200, activeRound: round, results: [] }
async function mockGame(page: Page) {
  await isolateProviders(page, true)
  await page.route('**/api/singleplayer/games', route => route.fulfill({ status: 201, json: preserved }))
  await page.route('**/api/singleplayer/games/r14-game', route => route.fulfill({ json: session }))
  await page.route('**/api/singleplayer/games/r14-game/rounds', route => route.fulfill({ status: 201, json: round }))
  await page.route('**/api/singleplayer/games/r14-game/rounds/*/intelligence', route => route.fulfill({ json: { fetchedAt: '', cached: false, climate: null, weather: { modelTime: null, temperatureC: 22, condition: 'Partly cloudy', windSpeedKmh: 18, windDirectionDeg: 225, humidityPct: 64, pressureHpa: 1013, precipitationMm: 0.8, precipitationIntervalMinutes: 60 }, environment: { elevationM: null, reliefM: null, terrain: null, biome: null, vegetation: null } } }))
}
async function currentStep(page: Page) {
  const text = await tutorial(page).locator('.tt-step-count').innerText()
  return Number(text.split('/')[0])
}
async function goToStep(page: Page, target: number) {
  let current = await currentStep(page)
  while (current < target) { await tutorial(page).getByRole('button', { name: 'Next' }).click(); current++ }
  while (current > target) { await tutorial(page).getByRole('button', { name: 'Previous' }).click(); current-- }
  await expect(tutorial(page).getByText(`${target} / 5`)).toBeVisible()
}
async function usableCard(page: Page) {
  await expect(page.locator('.tt-coach')).toHaveCount(1)
  const card = tutorial(page).locator('.tt-coach')
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await expect(tutorial(page).getByRole('button', { name: 'Exit tutorial' })).toBeInViewport()
  await expect(tutorial(page).getByRole('button', { name: /^(Next|Finish tutorial)$/ })).toBeInViewport()
  await expect(tutorial(page).getByRole('button', { name: 'Previous', exact: true })).toBeInViewport()
}
async function noOverlap(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const card = document.querySelector('.tt-coach')!.getBoundingClientRect()
    const ring = document.querySelector('.tt-target-ring')?.getBoundingClientRect()
    return !ring || card.right <= ring.left || card.left >= ring.right || card.bottom <= ring.top || card.top >= ring.bottom
  })).toBe(true)
}

test('R14: home entry opens one concise guide without starting a game', async ({ page }) => {
  await isolateProviders(page)
  const mutations: string[] = []
  page.on('request', req => { if (req.url().includes('/api/singleplayer/') && req.method() !== 'GET') mutations.push(req.url()) })
  await page.goto('/')
  await page.getByRole('link', { name: 'Help' }).click()
  await expect(tutorial(page)).toBeVisible()
  await usableCard(page)
  await expect(page.locator('.gi-panel')).toHaveCount(0)
  await expect(tutorial(page).getByText('Use temperature, rainfall, humidity and wind to narrow down where you might be.')).toBeVisible()
  expect(mutations).toEqual([])
})

test('R14: one concise sentence per step, Previous, Next and completion', async ({ page }) => {
  await isolateProviders(page); await open(page)
  await tutorial(page).getByRole('button', { name: 'Next' }).click()
  await expect(tutorial(page).getByRole('heading', { name: 'Pick your location' })).toBeFocused()
  await expect(tutorial(page).getByText('Choose where you think you are. You can change your answer before submitting.')).toBeVisible()
  await tutorial(page).getByRole('button', { name: 'Previous' }).click()
  await expect(tutorial(page).getByText('1 / 5')).toBeVisible()
  for (let number = 2; number <= 5; number++) {
    await tutorial(page).getByRole('button', { name: 'Next' }).click()
    await expect(tutorial(page).getByText(`${number} / 5`)).toBeVisible()
    if (number === 4) await expect(tutorial(page).getByLabel('Tutorial example: London to Paris')).toContainText('343.6 km')
  }
  for (const [distance, score] of [['0', '5,000'], ['2000', '4,522'], ['20000', '0']]) {
    await tutorial(page).getByRole('slider').fill(distance!)
    await expect(tutorial(page).getByLabel('Example score')).toContainText(score!)
  }
  await tutorial(page).getByRole('button', { name: 'Finish tutorial' }).click()
  await expect(tutorial(page)).toHaveCount(0)
  await open(page)
  await expect(tutorial(page).getByText('1 / 5')).toBeVisible()
})

test('R14: illustrative practice never submits a guess, then exits', async ({ page }) => {
  await isolateProviders(page); await open(page)
  const mutations: string[] = []
  page.on('request', request => { if (request.url().includes('/api/singleplayer/') && request.method() !== 'GET') mutations.push(request.url()) })
  await goToStep(page, 4)
  await expect(tutorial(page).getByLabel('Tutorial example: London to Paris')).toContainText('343.6 km')
  await goToStep(page, 5)
  await tutorial(page).getByRole('slider', { name: 'Example distance in kilometers' }).fill('2000')
  await expect(tutorial(page).getByLabel('Example score')).toContainText('4,522')
  expect(mutations).toEqual([])
  await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).click()
  await expect(tutorial(page)).toHaveCount(0)
})

test('R14: actual targets, no duplicated UI, exit and restart at every step preserve the session', async ({ page }) => {
  await mockGame(page)
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await expect(page.locator('.tt-coach')).toHaveAttribute('data-target', 'Weather')
  await expect(page.locator('.gi-panel')).toHaveCount(1)
  await expect(tutorial(page).locator('.sp-map-surface, .gi-panel, .sp-guess-button')).toHaveCount(0)
  await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).click()
  const panorama = await page.locator('.sp-panorama').elementHandle()
  const mutations: string[] = []
  page.on('request', req => { if (req.url().includes('/api/singleplayer/') && req.method() !== 'GET') mutations.push(req.url()) })
  for (let number = 1; number <= 5; number++) {
    await page.getByRole('button', { name: 'Game menu' }).click()
    await page.getByRole('button', { name: 'How to play', exact: true }).click()
    await goToStep(page, number)
    await usableCard(page); await noOverlap(page)
    await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).click()
    await page.getByRole('button', { name: 'Game menu', exact: true }).click()
    await page.getByRole('button', { name: 'How to play', exact: true }).click()
    await expect(tutorial(page).getByText('1 / 5')).toBeVisible()
    await goToStep(page, number)
    if (number % 2) await page.keyboard.press('Escape')
    else await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).click()
    await expect(tutorial(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Game menu' })).toBeFocused()
    await expect(page.locator('.sp-hud')).toContainText('4,200')
    expect(await panorama!.evaluate(el => el.isConnected)).toBe(true)
  }
  expect(mutations).toEqual([])
})

test('R14: automatic new-game opening survives seen tracking and game restart', async ({ page }) => {
  await mockGame(page)
  let creates = 0
  await page.addInitScript(() => localStorage.setItem('terraguessr.tutorialSeen.v1', '1'))
  await page.route('**/api/singleplayer/games', async route => { creates++; await route.fulfill({ status: 201, json: preserved }) })
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await expect(tutorial(page)).toBeVisible(); expect(creates).toBe(1)
  await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).click()
  await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole('button', { name: 'Restart game' }).click()
  await page.getByRole('dialog', { name: 'Start a new expedition?' }).getByRole('button', { name: 'Restart game' }).click()
  await expect(tutorial(page)).toBeVisible()
  await expect.poll(() => creates).toBe(2)
})

test('R14: real targets and card do not overlap at phone, tablet, laptop or desktop sizes', async ({ page }) => {
  await mockGame(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/game/singleplayer')
  await page.getByRole('button', { name: /Start exploring/i }).click()
  for (const [width, height] of [[320, 720], [375, 812], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: width!, height: height! })
    for (let number = 1; number <= 5; number++) {
      await goToStep(page, number)
      await usableCard(page); await noOverlap(page)
    }
  }
})

test('R14: keyboard focus stays inside the guide and Escape always exits', async ({ page }) => {
  await isolateProviders(page); await open(page)
  const guide = tutorial(page)
  await goToStep(page, 5)
  await guide.getByRole('button', { name: 'Exit tutorial' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(guide.getByRole('button', { name: 'Finish tutorial' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(guide.getByRole('button', { name: 'Exit tutorial' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)
})

test('R14: Chromium browser zoom at 200% keeps the guide usable', async ({ baseURL }) => {
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-r14-zoom-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL, args: ['--window-size=1280,900'],
  })
  try {
    const page = await context.newPage()
    await page.goto('chrome://settings/appearance')
    await page.locator('#zoomLevel').selectOption({ label: '200%' })
    await isolateProviders(page); await open(page)
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2)
    for (let number = 1; number <= 5; number++) {
      await goToStep(page, number)
      const card = tutorial(page).locator('.tt-coach')
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      const next = tutorial(page).getByRole('button', { name: /^(Next|Finish tutorial)$/ })
      await next.scrollIntoViewIfNeeded(); await expect(next).toBeInViewport()
      await tutorial(page).getByRole('button', { name: 'Exit tutorial' }).scrollIntoViewIfNeeded()
      await expect(tutorial(page).getByRole('button', { name: 'Exit tutorial' })).toBeInViewport()
    }
  } finally { await context.close(); await rm(profile, { recursive: true, force: true }) }
})
