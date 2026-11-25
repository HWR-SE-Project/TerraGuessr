import { expect, test, type Page } from '@playwright/test'

const now = new Date('2026-11-24T12:00:00Z')
const point = { lat: 51.5, lon: -0.12 }
const candidates = [{ id: 'london', name: 'London', region: 'Europe' }]
const free = { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 }
const easy = { selectionMode: 'list', countryBorders: true, attemptsPerRound: 3, timeLimitSeconds: 420, extraData: { mode: 'free' } }
const medium = { selectionMode: 'map', countryBorders: true, attemptsPerRound: 2, timeLimitSeconds: 240, extraData: { mode: 'points', cost: 100 } }
const hard = { selectionMode: 'map', countryBorders: true, attemptsPerRound: 1, timeLimitSeconds: 120, extraData: { mode: 'time', cost: 20 } }
const lockedClues = { ...free, mode: 'points', cost: 100, unlocked: false }
const result = { roundId: 'first', number: 1, actual: point, guess: point, distanceKm: 0, score: 5000 }
const lobbyResult = { ...result, roundNumber: 1, attemptsUsed: 1, guesses: [] }
const expiresAfter = (seconds: number) => new Date(now.getTime() + seconds * 1000).toISOString()

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|arcgisonline\.com|basemaps\.cartocdn\.com/, (route) => route.abort())
})

function round(number = 1, deadline = expiresAfter(120)) {
  return {
    id: number === 1 ? 'first' : 'second',
    number,
    scene: {
      biome: 'urban',
      weather: 'clear',
      lighting: 'day',
      temperatureBand: 'mild',
      windBand: 'calm',
      seed: 1000 + number,
    },
    startedAt: now.toISOString(),
    endsAt: deadline,
    attemptsUsed: 0,
    attemptsTotal: 3,
    rules: easy,
    selection: null,
    candidates,
    extraData: free,
  }
}

async function openSolo(page: Page, readSession: () => object, difficulty = 'Easy', intelligence: object = { weather: null }) {
  await page.route('**/api/singleplayer/games', (route) => route.fulfill({ json: { id: 'fixture', playerToken: 'solo-token' } }))
  await page.route('**/api/singleplayer/games/fixture', (route) => route.fulfill({ json: readSession() }))
  await page.route('**/api/singleplayer/games/fixture/rounds/*/selection', (route) => route.fulfill({ status: 204 }))
  await page.route('**/api/singleplayer/games/fixture/rounds/*/intelligence', (route) => route.fulfill({ json: intelligence }))
  await page.goto('/singleplayer')
  await page.getByRole('radio', { name: new RegExp(difficulty) }).click()
  await page.getByRole('button', { name: 'Start exploring' }).click()
}

function lobbyState({ number = 1, finalized = false, difficulty = 'easy', deadline = expiresAfter(120), selection = null as typeof point | null } = {}) {
  const rules = difficulty === 'hard' ? hard : difficulty === 'medium' ? medium : easy
  const active = {
    ...round(number), attemptsTotal: rules.attemptsPerRound,
    candidates: difficulty === 'easy' ? candidates : undefined,
    extraData: difficulty === 'hard' ? { ...free, mode: 'time', cost: 20, unlocked: false } : difficulty === 'medium' ? lockedClues : free,
  }
  return {
    lobby: { lobbyId: 'lobby', code: 'ABC123', difficulty, rules },
    match: {
      matchId: 'match', status: 'playing', currentRound: number, roundsTotal: 3, difficulty, rules, endsAt: deadline,
      round: active, roundComplete: false, reviewEndsAt: null, pendingPlayers: ['Guest'], leaderboard: [],
      you: { attemptsUsed: finalized ? 1 : 0, attemptsTotal: rules.attemptsPerRound, finalized, selection, result: null },
      results: number > 1 ? [lobbyResult] : [],
    },
  }
}

async function openLobby(page: Page, readMatch: () => object, {
  skipPoll = () => false, intelligence = { weather: null }, session = { token: 'lobby-token', isHost: true },
}: {
  skipPoll?: () => boolean
  intelligence?: object
  session?: { token: string; isHost: boolean }
} = {}) {
  await page.addInitScript((identity) => localStorage.setItem('terraguessr.lobby.session.v1', JSON.stringify({ code: 'ABC123', ...identity })), session)
  await page.route('**/api/lobbies/ABC123/match', (route) => {
    expect(route.request().headers()['x-lobby-token']).toBe(session.token)
    return skipPoll() ? route.abort() : route.fulfill({ json: readMatch() })
  })
  await page.route('**/api/lobbies/ABC123/selection', (route) => route.fulfill({ status: 204 }))
  await page.route('**/api/lobbies/ABC123/rounds/*/intelligence', (route) => route.fulfill({ json: intelligence }))
  await page.goto('/lobby/ABC123/play')
}

test('solo can finalize its first guess', async ({ page }) => {
  await page.clock.install({ time: now })
  await page.route('**/api/singleplayer/games/fixture/rounds/first/guess', (route) => {
    expect(route.request().postDataJSON()).toEqual({ candidateId: 'london', final: true })
    return route.fulfill({ json: { finalized: true, attemptsRemaining: 0, result } })
  })
  await openSolo(page, () => ({ difficulty: 'easy', totalScore: 0, results: [], activeRound: round() }))
  await page.getByRole('button', { name: 'London', exact: false }).click()
  await page.getByRole('button', { name: 'Final submit' }).click()
  await expect(page.getByRole('dialog', { name: 'Round 1 result' })).toContainText('5,000')
})

test('solo resumes an older city-list round that omits rules and selection', async ({ page }) => {
  await page.clock.install({ time: now })
  const legacyRound = { ...round(), rules: undefined, selection: undefined }
  await page.route('**/api/singleplayer/games/fixture/rounds/first/guess', (route) => {
    expect(route.request().postDataJSON()).toEqual({ candidateId: 'london', final: true })
    return route.fulfill({ json: { finalized: true, attemptsRemaining: 0, result } })
  })
  await openSolo(page, () => ({ difficulty: 'easy', totalScore: 0, results: [], activeRound: legacyRound }))
  await expect(page).toHaveURL(/\/singleplayer\/play$/)
  await page.getByRole('button', { name: 'London' }).click()
  await page.getByRole('button', { name: 'Final submit' }).click()
  await expect(page.getByRole('dialog', { name: 'Round 1 result' })).toBeVisible()
})

test('solo starts and unlocks an older map round that omits rules', async ({ page }) => {
  await page.clock.install({ time: now })
  const legacyRound = {
    ...round(), rules: undefined, selection: undefined, candidates: undefined,
    attemptsTotal: 2, extraData: lockedClues,
  }
  await page.route('**/api/singleplayer/games/fixture/rounds', (route) => route.fulfill({ json: legacyRound }))
  await page.route('**/api/singleplayer/games/fixture/rounds/first/unlock', (route) => route.fulfill({
    json: { ...legacyRound, extraData: { ...lockedClues, unlocked: true } },
  }))
  await openSolo(page, () => ({ difficulty: 'medium', totalScore: 0, results: [], activeRound: null }), 'Medium')
  await expect(page.getByText('Place your pin')).toBeVisible()
  const unlock = page.getByRole('button', { name: /Unlock.*100 pts/ })
  await unlock.click()
  await expect(unlock).toHaveCount(0)
  await expect(page.getByText('Place your pin')).toBeVisible()
})

test('solo shows a clear error instead of the summary when weather lookup fails on game start (R13)', async ({ page }) => {
  const message = 'No location with available weather data could be found nearby. Please retry.'
  let failStart = true
  await page.route('**/api/singleplayer/games/fixture/rounds', (route) => {
    if (failStart) {
      return route.fulfill({ status: 503, json: { error: { code: 'WEATHER_UNAVAILABLE', message } } })
    }
    return route.fulfill({ json: round() })
  })
  await openSolo(page, () => ({ difficulty: 'easy', totalScore: 0, results: [], activeRound: null }))
  await expect(page.getByRole('heading', { name: 'Could not start the game' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(message)
  await expect(page.getByRole('heading', { name: 'Well explored!' })).toHaveCount(0)

  failStart = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Submit guess' })).toBeVisible()
})

test('solo timeout loads the server result without submitting a guess', async ({ page }) => {
  await page.clock.install({ time: now })
  let expired = false
  let guesses = 0
  await page.route('**/api/singleplayer/games/fixture/rounds/first/guess', (route) => {
    guesses += 1
    return route.abort()
  })
  await openSolo(page, () => ({
    difficulty: 'easy', totalScore: 0,
    results: expired ? [{ ...result, guess: null, distanceKm: null, score: 0 }] : [],
    activeRound: expired ? null : round(),
  }))
  await expect(page.getByRole('button', { name: 'Submit guess' })).toBeVisible()
  expired = true
  await page.clock.fastForward(121_000)
  await expect(page.getByRole('dialog', { name: 'Round 1 result' })).toContainText('+0')
  expect(guesses).toBe(0)
})

test('both players review results and standings before the next round opens (R16)', async ({ page: host, browser, baseURL }) => {
  const guest = await browser.newPage({ baseURL, viewport: { width: 1280, height: 800 } })
  const players = [[host, 'host', true], [guest, 'guest', false]] as const
  const locked = new Set<string>()
  let roundNumber = 1
  let finalStandings = false
  const board = [
    { memberId: 'host', displayName: 'Host', rank: 1, totalScore: 5000 },
    { memberId: 'guest', displayName: 'Guest', rank: 2, totalScore: 4500 },
  ]
  const guesses = board.map((entry) => ({
    memberId: entry.memberId, displayName: entry.displayName,
    guess: point, score: entry.totalScore, answer: 'London',
  }))

  function state(token: string) {
    const reviewing = locked.size === 2 && !finalStandings
    const { lobby, match } = lobbyState({ number: roundNumber, finalized: locked.has(token), deadline: expiresAfter(125) })
    const reviewResult = { ...lobbyResult, roundNumber, guesses }
    return {
      lobby,
      match: {
        ...match,
        status: finalStandings ? 'finished' : 'playing',
        round: finalStandings ? null : match.round,
        endsAt: reviewing ? null : match.endsAt,
        roundComplete: reviewing || finalStandings,
        reviewEndsAt: reviewing ? expiresAfter(roundNumber === 1 ? 5 : 10) : null,
        leaderboard: board.map((entry) => ({ ...entry, isYou: entry.memberId === token })),
        you: { ...match.you, result: reviewing ? reviewResult : null },
        results: reviewing || finalStandings ? [reviewResult] : match.results,
      },
    }
  }

  try {
    await host.setViewportSize({ width: 320, height: 568 })
    await guest.route(/tile\.openstreetmap\.org|arcgisonline\.com|basemaps\.cartocdn\.com/, (route) => route.abort())
    for (const [page, token, isHost] of players) {
      await page.clock.setFixedTime(now)
      await page.route('**/api/lobbies/ABC123/rounds/1/guess', (route) => {
        expect(route.request().headers()['x-lobby-token']).toBe(token)
        expect(route.request().postDataJSON()).toEqual({ candidateId: 'london', final: true })
        locked.add(token)
        return route.fulfill({ json: { finalized: true, attemptsRemaining: 0, attemptsUsed: 1 } })
      })
      await openLobby(page, () => state(token), { session: { token, isHost } })
      await expect(page.getByRole('list', { name: 'Leaderboard' })).toHaveCount(0)
    }

    async function lockGuess(page: Page) {
      await page.getByRole('button', { name: 'London' }).click()
      await page.getByRole('button', { name: 'Final submit' }).click()
    }

    await lockGuess(host)
    await expect(host.getByText('Guess locked. Waiting for the round to finish.')).toBeVisible()
    await expect(host.getByRole('dialog', { name: 'Round 1 results' })).toHaveCount(0)
    await expect(guest.getByRole('button', { name: 'Submit guess' })).toBeVisible()

    await lockGuess(guest)
    for (const [page] of players) {
      const review = page.getByRole('dialog', { name: 'Round 1 results' })
      const rows = review.getByRole('listitem')
      await expect(rows).toHaveCount(2)
      await expect(rows.first()).toContainText('Host')
      await expect(rows.last()).toContainText('+4,500 this round')
      await expect(rows.last()).toBeInViewport({ ratio: 1 })
      await expect(review.getByLabel('Next round in 0:05')).toBeVisible()
      await expect(review.getByRole('button', { name: 'Continue' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Submit guess' })).toHaveCount(0)
      await page.clock.setFixedTime(new Date(expiresAfter(4)))
      await expect(review.getByLabel('Next round in 0:01')).toBeVisible()
    }

    await host.reload()
    await expect(host.getByLabel('Next round in 0:01')).toBeVisible()
    locked.clear()
    roundNumber = 2
    for (const [page] of players) {
      await page.clock.setFixedTime(new Date(expiresAfter(5)))
      await expect(page.getByRole('dialog', { name: 'Round 1 results' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Submit guess' })).toBeVisible()
      await expect(page.getByLabel('Time remaining 2:00')).toBeVisible()
      await expect(page.getByRole('list', { name: 'Leaderboard' })).toHaveCount(0)
    }

    roundNumber = 3
    locked.add('host').add('guest')
    for (const [page] of players) {
      await expect(page.getByRole('dialog', { name: 'Round 3 results' }).getByLabel('Final standings in 0:05')).toBeVisible()
    }
    finalStandings = true
    for (const [page] of players) {
      await page.clock.setFixedTime(new Date(expiresAfter(10)))
      await expect(page.getByRole('heading', { name: 'Match complete' })).toBeVisible()
      await expect(page.getByRole('list', { name: 'Leaderboard' }).getByRole('listitem')).toHaveCount(2)
    }
  } finally {
    await guest.close()
  }
})

test('multiplayer uses the personal Hard deadline without sending a dummy guess', async ({ page }) => {
  await page.clock.install({ time: now })
  let match = lobbyState({ difficulty: 'hard' })
  let guesses = 0
  await page.route('**/api/lobbies/ABC123/rounds/*/guess', (route) => {
    guesses += 1
    return route.abort()
  })
  await page.route('**/api/lobbies/ABC123/rounds/1/unlock', (route) => {
    match = lobbyState({ difficulty: 'hard', deadline: expiresAfter(100) })
    match.match.round.extraData.unlocked = true
    return route.fulfill({ json: match })
  })
  await openLobby(page, () => match)
  await page.getByRole('button', { name: /Unlock.*20s/ }).click()
  await expect.poll(async () => {
    const label = await page.locator('[aria-label^="Time remaining"]').getAttribute('aria-label')
    const [minutes, seconds] = label!.replace('Time remaining ', '').split(':').map(Number)
    const browserTime = await page.evaluate(() => Date.now())
    const expected = Math.round((Date.parse(expiresAfter(100)) - browserTime) / 1000)
    return Math.abs(minutes * 60 + seconds - expected)
  }).toBeLessThanOrEqual(1)
  await page.clock.fastForward(101_000)
  await expect(page.getByLabel('Time remaining 0:00')).toBeVisible()
  expect(guesses).toBe(0)
})

test('multiplayer updates attempts from a successful submission before the next poll returns', async ({ page }) => {
  await page.clock.install({ time: now })
  let submitAcknowledged = false
  await page.route('**/api/lobbies/ABC123/rounds/1/guess', (route) => {
    expect(route.request().postDataJSON()).toEqual({ candidateId: 'london', final: false })
    submitAcknowledged = true
    return route.fulfill({ json: { finalized: false, attemptsRemaining: 2 } })
  })
  await openLobby(page, () => lobbyState(), { skipPoll: () => submitAcknowledged })
  await page.getByRole('button', { name: 'London', exact: false }).click()
  await page.getByRole('button', { name: 'Submit guess' }).click()
  await expect(page.getByText('2 tries left')).toBeVisible()
})

for (const mode of ['solo', 'multiplayer'] as const) {
  test(mode + ' keeps core weather readable on narrow and short screens (R15)', async ({ page }) => {
    await page.clock.install({ time: now })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 568 })
    const cities = ['London', 'Paris', 'Vancouver', 'Mexico City', 'Buenos Aires', 'Auckland']
      .map((name, index) => ({ id: String(index), name, region: 'Candidate region' }))
    const intelligence = {
      weather: {
        modelTime: now.toISOString(), temperatureC: -12.5, condition: 'Freezing drizzle',
        precipitationMm: 0, humidityPct: 100, windSpeedKmh: 112.32,
        windDirectionDeg: 225, pressureHpa: 1013,
      },
      environment: { elevationM: 1200, terrain: 'High relief' },
    }
    if (mode === 'solo') {
      await openSolo(page, () => ({
        difficulty: 'easy', results: [],
        activeRound: { ...round(), candidates: cities },
      }), 'Easy', intelligence)
    } else {
      const { lobby, match } = lobbyState()
      await openLobby(page, () => ({
        lobby,
        match: {
          ...match,
          round: { ...match.round, candidates: cities },
          leaderboard: [{ rank: 1, displayName: 'Explorer', isYou: true, totalScore: 0 }],
        },
      }), { intelligence })
    }

    const panel = page.getByRole('complementary', { name: 'Geographic intelligence' })
    const metrics = panel.getByText(/^(?:Temperature|-12\.5°C|Precipitation|0 mm|Humidity|100%|Wind speed|31\.2 m\/s SW)$/)
    const controls = page.getByRole('region', { name: 'Round controls' })
    for (const [width, height] of [[320, 568], [390, 844], [768, 432], [1440, 900]]) {
      await page.setViewportSize({ width: width!, height: height! })
      await controls.evaluate((element) => { element.scrollTop = 0 })
      await expect(metrics).toHaveText(['Temperature', '-12.5°C', 'Precipitation', '0 mm', 'Humidity', '100%', 'Wind speed', '31.2 m/s SW'])

      // Check rendered text, including wrapped lines, through the viewport and scroll container.
      await expect.poll(() => metrics.evaluateAll((elements) => elements.flatMap((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const obstructed = Array.from(range.getClientRects()).some((rect) => {
          if (rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) return true
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return !element.contains(hit)
        })
        return obstructed ? [element.textContent] : []
      })), 'weather labels and values fit at ' + width + ' × ' + height).toEqual([])

      const menu = page.getByRole('button', { name: 'Game menu' })
      await expect(menu).toBeInViewport({ ratio: 1 })
      await page.getByRole('button', { name: /Auckland/ }).click()
      await expect(page.getByRole('button', { name: 'Submit guess' })).toBeEnabled()
    }
  })

  test(`${mode} keeps clue and guess requests from overlapping`, async ({ page }) => {
    await page.clock.install({ time: now })
    let allowGuess!: () => void
    let allowUnlock!: () => void
    const pendingGuess = new Promise<void>((resolve) => { allowGuess = resolve })
    const pendingUnlock = new Promise<void>((resolve) => { allowUnlock = resolve })
    const attemptsRemaining = 1
    const soloRound = { ...round(), rules: medium, attemptsTotal: 2, candidates: undefined, selection: point, extraData: lockedClues }
    const match = lobbyState({ difficulty: 'medium', selection: point })
    const routePrefix = mode === 'solo' ? '**/api/singleplayer/games/fixture/rounds/first' : '**/api/lobbies/ABC123/rounds/1'
    await page.route(`${routePrefix}/guess`, async (route) => {
      await pendingGuess
      match.match.you.attemptsUsed = 1
      return route.fulfill({ json: { finalized: false, attemptsRemaining } })
    })
    await page.route(`${routePrefix}/unlock`, async (route) => {
      await pendingUnlock
      match.match.round.extraData = { ...lockedClues, unlocked: true }
      const updated = { ...soloRound, attemptsUsed: 1, extraData: match.match.round.extraData }
      return route.fulfill({ json: mode === 'solo' ? updated : match })
    })

    try {
      if (mode === 'solo') {
        await openSolo(page, () => ({ difficulty: 'medium', totalScore: 0, results: [], activeRound: soloRound }))
      } else {
        await openLobby(page, () => match)
      }
      const unlock = page.getByRole('button', { name: /Unlock.*100 pts/ })
      await expect(unlock).toBeEnabled()
      await page.getByRole('button', { name: 'Submit guess' }).click()
      await expect(unlock).toBeDisabled()
      allowGuess()
      await expect(page.getByText('1 try left')).toBeVisible()

      await unlock.click()
      await expect(page.getByRole('button', { name: 'Unlocking…' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Submit guess' })).toBeDisabled()
      allowUnlock()
      await expect(page.getByRole('button', { name: 'Submit guess' })).toBeEnabled()
      await expect(unlock).toHaveCount(0)
      await expect(page.getByText('1 try left')).toBeVisible()
    } finally {
      allowGuess()
      allowUnlock()
    }
  })
}
