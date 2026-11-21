import { requestGameExit } from './support/navigation'
import { expect, test } from '@playwright/test'
import type { StreetResult } from '../frontend/src/api/singleplayer'
import { mkdir, writeFile } from 'node:fs/promises'

// Real Google SDK, imagery, tiles, backend and database. No route interception,
// credentials in artifacts, seeded responses, or replacement panorama images.
test('live Google: Home through six endless rounds, End Game summary, new game, and Home', async ({
  page,
}) => {
  test.skip(
    process.env.TERRAGUESSR_LIVE_MAPS !== '1',
    'Run npm run maps:verify with configured Google Maps credentials.',
  )
  test.setTimeout(300_000)
  const out = 'docs/screenshots/session-navigation'
  await mkdir(out, { recursive: true })
  const errors: string[] = []
  const redact = (text: string) =>
    text.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_KEY]')
  page.on('pageerror', (error) => errors.push(redact(error.message)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(redact(message.text()))
  })
  const report: {
    provider: string
    rounds: StreetResult[]
    errors: string[]
    cameraMoved?: boolean
    streetNavigated?: boolean
    continuedPastFiveRounds?: boolean
    keptPlayingAfterExitPrompt?: boolean
    ended?: boolean
    restarted?: boolean
    endedEmptySession?: boolean
    returnedHome?: boolean
  } = {
    provider: 'Google Maps JavaScript API / Google Street View',
    rounds: [],
    errors,
  }
  const ROUNDS = 6 // Past the old five-round cap — proves endless continuation (R01).
  const waitForPanorama = async () => {
    const viewer = page.locator('.sp-panorama')
    // A disconnected panorama is replaced explicitly in its current round.
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect
        .poll(
          async () => {
            if ((await viewer.getAttribute('data-ready')) === 'true')
              return 'ready'
            return (await page
              .getByRole('button', {
                name: 'Try another location',
                exact: true,
              })
              .isVisible())
              ? 'unavailable'
              : 'loading'
          },
          { timeout: 50_000 },
        )
        .not.toBe('loading')
      if ((await viewer.getAttribute('data-ready')) === 'true') return viewer
      await page
        .getByRole('button', { name: 'Try another location', exact: true })
        .click()
    }
    throw new Error(
      'Three genuine panorama attempts failed; inspect provider messages.',
    )
  }
  try {
    await page.setViewportSize({ width: 1792, height: 861 })
    await page.goto('/')
    await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
    await page.screenshot({ path: `${out}/home.png` })
    await page.goto('/multiplayer')
    await expect(page.getByRole('heading', { name: 'Multiplayer', exact: true })).toBeVisible()
    await page.screenshot({ path: `${out}/multiplayer.png` })
    await page.goto('/')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.screenshot({ path: `${out}/mobile-navigation.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1792, height: 861 })
    const config = await page.request.get('/api/singleplayer/config')
    expect(config.ok()).toBe(true)
    expect((await config.json()).available).toBe(true)
    await page
      .getByRole('link', { name: 'Play Solo Challenge yourself', exact: true })
      .click()
    await expect(page).toHaveURL(/\/game\/singleplayer$/)
    // R05: a fresh visit lands on the difficulty picker, not an auto-started
    // round. Default difficulty (medium) is used for this coverage.
    await expect(page.getByRole('radio', { name: /Medium/ })).toBeVisible()
    await page.screenshot({ path: `${out}/setup.png` })
    await page.getByRole('button', { name: 'Start exploring' }).click()
    // R14: the tutorial opens from the Start-exploring click itself (a new
    // game starting), not from mount — so wait for it only after that click,
    // then dismiss it before the round it's loading in the background is on screen.
    const skipTutorial = page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ })
    try {
      await skipTutorial.waitFor({ state: 'visible', timeout: 8_000 })
      await skipTutorial.click()
    } catch {
      // Already seen in this profile this run; nothing to dismiss.
    }
    for (let number = 1; number <= ROUNDS; number++) {
      const viewer = await waitForPanorama()
      await expect(page.locator('.sp-welcome')).toHaveCount(0)
      await expect(page.locator('.sp-hud')).toContainText(`${number}`)
      if (number === 6) {
        // Past the old five-round cap: the game kept going without a forced
        // final-results transition (R01/endless mode).
        await page.waitForTimeout(500)
        await page.screenshot({ path: `${out}/round-six.png` })
        report.continuedPastFiveRounds = true
      }
      if (number === 1) {
        await page.waitForTimeout(1500) // Allow actual imagery tiles to paint before capture.
        await page.screenshot({ path: `${out}/active-desktop.png` })
        const heading = await viewer.getAttribute('data-heading')
        await page.mouse.move(600, 350)
        await page.mouse.down()
        await page.mouse.move(900, 350, { steps: 12 })
        await page.mouse.up()
        await expect
          .poll(() => viewer.getAttribute('data-heading'))
          .not.toBe(heading)
        report.cameraMoved = true
        const pano = await viewer.getAttribute('data-panorama')
        // Follow a real connected street; forward can have no link at this POV.
        await viewer.getByRole('button', { name: /^Go / }).first().click()
        await expect
          .poll(() => viewer.getAttribute('data-panorama'), { timeout: 15000 })
          .not.toBe(pano)
        report.streetNavigated = true
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: `${out}/active-mobile.png` })
        await page.setViewportSize({ width: 1792, height: 861 })
      }
      const expand = page.getByRole('button', {
        name: 'Expand map',
        exact: true,
      })
      if (await expand.isVisible()) await expand.click()
      await page.mouse.move(600, 100)
      const world = page.locator('.sp-guess-panel .sp-google-map')
      await expect(world.locator('img').first()).toBeVisible({ timeout: 15000 })
      await world.click({ position: { x: 220, y: 160 } })
      await expect(
        page.getByRole('button', { name: 'Guess', exact: true }),
      ).toBeEnabled()
      if (number === 1) {
        await page.waitForTimeout(350)
        await page.screenshot({ path: `${out}/expanded-map.png` })
        await page.getByRole('button', { name: 'World Explorer' }).click()
        await expect(page.locator('#guess-map-content')).toBeHidden()
        await page.getByRole('button', { name: 'World Explorer' }).click()
        await expect(
          page.getByRole('button', { name: 'Guess', exact: true }),
        ).toBeEnabled()
      }
      const response = page.waitForResponse(
        (response) =>
          response.url().includes('/singleplayer/games/') &&
          response.url().endsWith('/guess') &&
          response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: 'Guess', exact: true }).click()
      const scored = await response
      expect(scored.ok()).toBe(true)
      const result = await scored.json()
      expect(result.number).toBe(number)
      const roundedKm = Math.round(result.distanceKm * 10) / 10
      const expectedScore =
        roundedKm <= 100
          ? 5000
          : roundedKm >= 20000
            ? 0
            : Math.floor((5000 * (20000 - roundedKm)) / 19900)
      expect(result.score).toBe(expectedScore)
      expect(Number.isFinite(result.actual.lat)).toBe(true)
      report.rounds.push(result)
      await expect(
        page.getByRole('region', { name: 'Round results' }),
      ).toBeVisible()
      if (number === 1) {
        await page.waitForTimeout(1500)
        await page.screenshot({ path: `${out}/round-results.png` })
      }
      // Always "Next round" — endless mode never offers a final-results
      // branch tied to a fixed round count. Stop at the last round's
      // results instead of advancing into a 7th round.
      if (number < ROUNDS)
        await page.getByRole('button', { name: 'Next round' }).click()
    }
    // Exiting mid-game always confirms first, and "Keep Playing" truly keeps
    // the session active rather than ending it.
    await requestGameExit(page)
    const exitDialog = page.getByRole('dialog', { name: 'End your adventure?' })
    await expect(exitDialog).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/end-game-confirm.png` })
    await exitDialog.getByRole('button', { name: 'Keep Playing' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.sp-hud')).toHaveCount(0)
    report.keptPlayingAfterExitPrompt = true
    // Now actually end the game — this finalizes the session and shows its summary.
    await requestGameExit(page)
    await page
      .getByRole('dialog', { name: 'End your adventure?' })
      .getByRole('button', { name: 'End Game' })
      .click()
    await expect(
      page.getByRole('region', { name: 'Final results' }),
    ).toBeVisible()
    await expect(page.locator('.sp-round-list details')).toHaveCount(ROUNDS)
    await expect(page.locator('.sp-summary-breakdown')).not.toHaveAttribute('open', '')
    await expect(page.locator('.sp-hud, .sp-guess-panel, .sp-panorama, .gi-panel')).toHaveCount(0)
    await expect(page.locator('.sp-summary-score strong')).toHaveText(
      report.rounds
        .reduce((sum, round) => sum + round.score, 0)
        .toLocaleString('en-US'),
    )
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/final-results.png` })
    await page.setViewportSize({ width: 1366, height: 768 })
    await expect(page.getByRole('button', { name: 'Return Home' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(768)
    await page.screenshot({ path: `${out}/completed-desktop.png` })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: `${out}/completed-mobile.png`, fullPage: true })
    await page.setViewportSize({ width: 1792, height: 861 })
    report.ended = true
    await page.getByRole('button', { name: 'Play again' }).click()
    await page.getByRole('dialog', { name: 'How to play / Tutorial' }).getByRole('button', { name: /^(Skip|Exit tutorial)$/ }).click()
    await waitForPanorama()
    report.restarted = true
    // Ending again immediately, before completing any rounds, must show the
    // empty-session state rather than fabricated results.
    await requestGameExit(page)
    await page
      .getByRole('dialog', { name: 'End your adventure?' })
      .getByRole('button', { name: 'End Game' })
      .click()
    await expect(page.getByRole('heading', { name: 'Adventure ended' })).toBeVisible()
    await page.screenshot({ path: `${out}/empty-desktop.png` })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: `${out}/empty-mobile.png`, fullPage: true })
    report.endedEmptySession = true
    await page.getByRole('button', { name: 'Return Home' }).click()
    await expect(page).toHaveURL(/\/$/)
    report.returnedHome = true
    expect(errors).toEqual([])
  } finally {
    await writeFile(
      `${out}/live-game-report.json`,
      JSON.stringify(report, null, 2) + '\n',
    )
  }
})

test('live Google mobile: touch map, preserve pin through collapse, refuse to resume after refresh, and submit', async ({
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.TERRAGUESSR_LIVE_MAPS !== '1',
    'Requires configured live Google Maps.',
  )
  test.setTimeout(90_000)
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  try {
    await page.goto('/game/singleplayer')
    await page.getByRole('button', { name: 'Start exploring' }).click()
    // See the R14 comment in the desktop test above: the tutorial opens from
    // this click, so wait for the dialog rather than racing an immediate
    // isVisible() check against it.
    const skipTutorial = page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ })
    try {
      await skipTutorial.waitFor({ state: 'visible', timeout: 8_000 })
      await skipTutorial.click()
    } catch {
      // Already seen in this profile this run; nothing to dismiss.
    }
    await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({
      timeout: 40_000,
    })
    const viewer = page.locator('.sp-panorama')
    const heading = await viewer.getAttribute('data-heading')
    const touch = await context.newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 100, y: 240 }],
    })
    for (let step = 1; step <= 8; step++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 100 + step * 12, y: 240 }],
      })
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect
      .poll(() => viewer.getAttribute('data-heading'))
      .not.toBe(heading)
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'docs/screenshots/playable/active-mobile.png',
    })
    await touch.detach()
    await page.getByRole('button', { name: 'Expand map', exact: true }).tap()
    const map = page.locator('.sp-guess-panel .sp-google-map')
    await map.tap({ position: { x: 150, y: 160 } })
    await expect(
      page.getByRole('button', { name: 'Guess', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'World Explorer' }).tap()
    await expect(page.locator('#guess-map-content')).toBeHidden()
    await page.getByRole('button', { name: 'World Explorer' }).tap()
    await expect(
      page.getByRole('button', { name: 'Guess', exact: true }),
    ).toBeEnabled()
    const chosen = await page.locator('.sp-map-footer > span').innerText()
    expect(chosen).not.toBe('Where in the world are you?')
    // R13: the browser's own generic beforeunload prompt still guards an
    // in-progress session (no custom text), but accepting it must not
    // silently promise the game comes back afterward.
    page.once('dialog', (dialog) => void dialog.accept())
    await page.reload()
    await expect(page.locator('.sp-welcome')).toBeVisible()
    await expect(page.locator('.sp-panorama')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Back to game' })).toHaveCount(0)
    // A fresh game starts cleanly after the refresh — no resumed round, pin, or score.
    await page.getByRole('button', { name: 'Start exploring' }).click()
    const skipAfterReload = page.getByRole('button', { name: /^(Skip|Exit tutorial)$/ })
    try {
      await skipAfterReload.waitFor({ state: 'visible', timeout: 8_000 })
      await skipAfterReload.click()
    } catch {
      // Already seen in this profile this run; nothing to dismiss.
    }
    await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({
      timeout: 40_000,
    })
    await page.getByRole('button', { name: 'Expand map', exact: true }).tap()
    const freshMap = page.locator('.sp-guess-panel .sp-google-map')
    await freshMap.tap({ position: { x: 150, y: 160 } })
    await expect(
      page.getByRole('button', { name: 'Guess', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Guess', exact: true }).tap()
    await expect(
      page.getByRole('region', { name: 'Round results' }),
    ).toBeVisible()
    await page.screenshot({
      path: 'docs/screenshots/playable/mobile-round-results.png',
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390)
  } finally {
    await context.close()
  }
})
