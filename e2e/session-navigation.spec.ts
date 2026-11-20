import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type Page } from '@playwright/test'
import { requestGameExit } from './support/navigation'

// Persisted-response fixtures exercise the real page/controller/router, with only
// external providers isolated. Real Google imagery is covered by the live suite.
async function gameFixture(page: Page, completed = false) {
  let ended = 0
  let creates = 0
  const results = completed ? [
    { roundId: 'one', number: 1, guess: { lat: 1, lon: 2 }, actual: { lat: 2, lon: 3 }, score: 4000, distanceKm: 100 },
    { roundId: 'two', number: 2, guess: { lat: 1, lon: 2 }, actual: { lat: 2, lon: 3 }, score: 5000, distanceKm: 300 },
  ] : []
  await page.route('**/maps.googleapis.com/maps/api/js?*', route => route.abort())
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available: true, provider: 'google', serverKeyConfigured: true } }))
  await page.route('**/api/singleplayer/games', route => { creates++; return route.fulfill({ status: 201, json: { id: 'nav-game', playerToken: 'test-only' } }) })
  await page.route('**/api/singleplayer/games/nav-game/rounds', route => route.fulfill({ status: 201, json: { id: 'active', number: results.length + 1, panoId: 'provider-double' } }))
  await page.route('**/api/singleplayer/games/nav-game', route => {
    if (route.request().method() === 'DELETE') { ended++; return route.fulfill({ status: 204 }) }
    return route.fulfill({ json: { id: 'nav-game', difficulty: 'hard', totalScore: completed ? 9000 : 0, activeRound: null, results } })
  })
  await page.route('**/api/singleplayer/games/nav-game/rounds/*/intelligence', route => route.fulfill({ status: 503, json: { error: { code: 'OFFLINE', message: 'Provider double' } } }))
  return { ended: () => ended, creates: () => creates }
}
async function start(page: Page) {
  await page.getByRole('button', { name: /Start exploring/i }).click()
  await page.getByRole('dialog', { name: 'How to play / Tutorial' }).getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
}
async function summary(page: Page) {
  await requestGameExit(page)
  await page.getByRole('button', { name: 'End Game', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Final results' })).toBeVisible()
  await expect(page.locator('.sp-hud, .sp-guess-panel, .gi-panel, .gi-mobile-trigger, .sp-panorama, .sp-compass')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guess', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Return Home', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Game menu' })).toHaveCount(0)
}

test('empty summary is compact, contains only the two actions, and Play Again creates a new session', async ({ page }) => {
  const api = await gameFixture(page)
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/game/singleplayer'); await start(page); await summary(page)
  await expect(page.getByRole('heading', { name: 'Adventure ended' })).toBeVisible()
  await expect(page.locator('.sp-summary-stats, .sp-round-list, .sp-summary-score')).toHaveCount(0)
  expect((await page.locator('.sp-session-summary').boundingBox())!.height).toBeLessThan(350)
  expect(api.ended()).toBe(1)
  await page.getByRole('button', { name: 'Play Again' }).click()
  await page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
  expect(api.creates()).toBe(2)
  await summary(page)
  await page.getByRole('button', { name: 'Return Home' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Explore the World' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'setup')
  expect(api.creates()).toBe(2)
})

test('completed summary uses saved results, reveals breakdown on demand and adapts through mobile and zoom-sized viewports', async ({ page }) => {
  await gameFixture(page, true)
  await page.goto('/game/singleplayer'); await start(page); await summary(page)
  await expect(page.locator('.sp-summary-score')).toHaveText('9,000total points')
  await expect(page.locator('.sp-summary-stats')).toHaveText(/Rounds completed2Average score \/ round4,500 ptsBest round5,000 pts Round 2Average distance200.0 kmDifficultyHard/)
  await expect(page.locator('.sp-summary-breakdown')).not.toHaveAttribute('open', '')
  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768], [683, 384], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    if (width >= 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height)
      await expect(page.getByRole('button', { name: 'Return Home' })).toBeInViewport()
    }
    await page.getByRole('button', { name: 'Return Home' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Return Home' })).toBeInViewport()
  }
  await page.locator('.sp-summary-breakdown > summary').click()
  await expect(page.locator('.sp-round-list > details')).toHaveCount(2)
  await expect(page.locator('.sp-round-list')).toContainText('100.0 km4,000 pts')
})

for (const destination of ['logo', 'multiplayer', 'duels', 'browser-back'] as const) {
  test(`active exit guard preserves destination and cancellation: ${destination}`, async ({ page }) => {
    const api = await gameFixture(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.getByRole('link', { name: 'Singleplayer', exact: true }).click()
    await start(page)
    const leave = async () => {
      if (destination === 'browser-back') await page.goBack()
      else await page.getByRole('link', { name: destination === 'logo' ? 'TerraGuessr home' : destination === 'duels' ? 'Duels' : 'Multiplayer', exact: true }).click()
    }
    await leave()
    await expect(page.getByRole('dialog', { name: 'End your adventure?' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep Playing' }).click()
    await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
    expect(api.ended()).toBe(0)
    await leave()
    await page.getByRole('button', { name: 'End Game', exact: true }).click()
    await expect(page).toHaveURL(destination === 'multiplayer' ? /\/multiplayer$/ : destination === 'duels' ? /\/duels$/ : /\/$/)
    expect(api.ended()).toBe(1)
    // A fresh visit never resumes the finalized session.
    await page.getByRole('link', { name: 'Singleplayer', exact: true }).click()
    await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'setup')
    expect(api.creates()).toBe(1)
  })
}

test('one responsive header exposes working help, settings and destinations without overlapping the logo', async ({ page }) => {
  await gameFixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const url of ['/', '/duels', '/multiplayer', '/auth', '/reset-password', '/verify-email', '/confirm-email-change', '/game/singleplayer']) {
    await page.goto(url)
    await expect(page.locator('.tg-page-nav')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'TerraGuessr home' })).toBeInViewport()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav.getByRole('link', { name: 'Duels', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  }
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Game settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Game settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await start(page)
  await page.getByRole('button', { name: 'Game menu' }).click()
  await expect(page.getByRole('link', { name: 'Multiplayer', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Game settings', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Game settings' })).toBeVisible()
})

test('failed finalization keeps the session active and preserves the intended route until retry succeeds', async ({ page }) => {
  await gameFixture(page)
  let attempts = 0
  await page.route('**/api/singleplayer/games/nav-game', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    attempts++
    await route.fulfill(attempts === 1
      ? { status: 503, json: { error: { code: 'OFFLINE', message: 'Offline' } } }
      : { status: 204 })
  })
  await page.goto('/game/singleplayer'); await start(page)
  await page.getByRole('link', { name: 'TerraGuessr home' }).click()
  await page.getByRole('button', { name: 'End Game', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unable to reach the game server')
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
  await expect(page).toHaveURL(/\/game\/singleplayer$/)
  await page.getByRole('button', { name: 'End Game', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(attempts).toBe(2)
})

test('Restart ends the old session before creating a fresh one', async ({ page }) => {
  const api = await gameFixture(page)
  await page.goto('/game/singleplayer'); await start(page)
  await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole('button', { name: 'Restart game', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restart game', exact: true }).click()
  await page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
  await expect(page.locator('.sp-page')).toHaveAttribute('data-view', 'playing')
  expect(api.ended()).toBe(1)
  expect(api.creates()).toBe(2)
})

test('multiplayer uses the shared header and a single accessible leave confirmation', async ({ page }) => {
  let leaves = 0
  await page.addInitScript(() => localStorage.setItem('terraguessr.lobby.NAV123', 'test-only'))
  await page.route('**/maps.googleapis.com/maps/api/js?*', route => route.abort())
  await page.route('**/api/lobbies/NAV123/match', route => route.fulfill({ json: {
    lobby: { lobbyId: 'lobby', code: 'NAV123', difficulty: 'medium', status: 'playing', roundsTotal: 5,
      rules: { timeLimitSeconds: 120, attemptsPerRound: 1, selectionMode: 'map' }, members: [], youAreHost: true,
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() },
    match: { status: 'playing', currentRound: 1, roundsTotal: 5, difficulty: 'medium',
      rules: { timeLimitSeconds: 120, attemptsPerRound: 1, selectionMode: 'map' },
      startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 120000).toISOString(),
      round: { id: 'mp-round', number: 1, panoId: 'provider-double' }, roundComplete: false, pendingPlayers: [],
      you: { attemptsUsed: 0, attemptsTotal: 1, selection: null, finalized: false, result: null },
      leaderboard: [], results: [], continuePrompt: null },
  } }))
  await page.route('**/api/lobbies/NAV123/rounds/*/intelligence', route => route.fulfill({ status: 503, json: { error: { code: 'OFFLINE', message: 'Offline' } } }))
  await page.route('**/api/lobbies/NAV123/leave', route => { leaves++; return route.fulfill({ status: 204 }) })
  await page.goto('/lobby/NAV123/game')
  await expect(page.getByRole('button', { name: 'Game menu' })).toBeVisible()
  await expect(page.locator('.tg-page-nav')).toHaveCount(1)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  }
  await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole('button', { name: 'Back to lobby', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.getByRole('button', { name: 'Keep Playing', exact: true }).click()
  expect(leaves).toBe(0)
  await page.getByRole('link', { name: 'TerraGuessr home' }).click()
  await page.getByRole('button', { name: 'Leave match', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(leaves).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('terraguessr.lobby.NAV123'))).toBeNull()
})


test('empty and completed summaries retain accessible controls at native browser zoom from 100 to 200 percent', async ({ baseURL }) => {
  test.setTimeout(90_000)
  const profile = await mkdtemp(join(tmpdir(), 'terraguessr-summary-zoom-'))
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: null, deviceScaleFactor: undefined, baseURL,
    args: ['--window-size=1366,768'],
  })
  const report: unknown[] = []
  try {
    const settings = await context.newPage()
    await settings.goto('chrome://settings/appearance')
    for (const completed of [false, true]) {
      const page = await context.newPage()
      await gameFixture(page, completed)
      await page.goto('/game/singleplayer'); await start(page); await summary(page)
      for (const zoom of [100, 125, 150, 200]) {
        await settings.locator('#zoomLevel').selectOption({ label: `${zoom}%` })
        await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom / 100, 1)
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
          scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }))
        expect(metrics.scrollWidth).toBe(metrics.width)
        if (zoom === 100) expect(metrics.scrollHeight).toBe(metrics.height)
        for (const name of ['Play Again', 'Return Home']) {
          const button = page.getByRole('button', { name, exact: true })
          await button.scrollIntoViewIfNeeded()
          await expect(button).toBeInViewport()
        }
        report.push({ completed, zoom, ...metrics })
      }
      await page.close()
    }
    await writeFile('docs/screenshots/session-navigation/summary-zoom-report.json', JSON.stringify(report, null, 2))
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})
