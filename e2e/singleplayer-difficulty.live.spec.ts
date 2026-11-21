import { expect, test } from '@playwright/test'

// Real Google SDK, imagery and backend — no route interception. Each test
// plays a single round at the scope needed to verify the difficulty's
// distinguishing behavior (R05), not a full five-round game (see
// singleplayer.live.spec.ts for the complete-game coverage).

test('live Google easy difficulty: list-mode guessing and expanded clues (R05/R07)', async ({
  page,
}) => {
  test.skip(
    process.env.TERRAGUESSR_LIVE_MAPS !== '1',
    'Run npm run maps:verify with configured Google Maps credentials.',
  )
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1792, height: 861 })
  await page.goto('/game/singleplayer')
  const exitTutorial = page.getByRole('button', { name: 'Exit tutorial' })
  try {
    await exitTutorial.waitFor({ state: 'visible', timeout: 8_000 })
    await exitTutorial.click()
  } catch {
    // Already seen in this profile this run; nothing to dismiss.
  }
  await page.getByRole('radio', { name: /Easy/ }).click()
  await page.getByRole('button', { name: 'Start exploring' }).click()
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({
    timeout: 45_000,
  })
  // Easy difficulty: clues expanded by default.
  const panel = page.getByRole('complementary', {
    name: 'Geographic intelligence',
  })
  await expect(
    panel.getByRole('button', { name: /GEOGRAPHIC INTELLIGENCE/ }),
  ).toHaveAttribute('aria-expanded', 'true')
  // Easy difficulty: a named-city list instead of a free map.
  const options = page.getByTestId('candidate-option')
  await expect(options).toHaveCount(6)
  const response = page.waitForResponse(
    (response) =>
      response.url().includes('/singleplayer/games/') &&
      response.url().endsWith('/guess') &&
      response.request().method() === 'POST',
  )
  await options.first().click()
  await expect(
    page.getByRole('button', { name: 'Guess', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Guess', exact: true }).click()
  const scored = await response
  expect(scored.ok()).toBe(true)
  await expect(
    page.getByRole('region', { name: 'Round results' }),
  ).toBeVisible()
})

test('live Google hard difficulty: free map placement with weather visible by default (R05/R06)', async ({
  page,
}) => {
  test.skip(
    process.env.TERRAGUESSR_LIVE_MAPS !== '1',
    'Run npm run maps:verify with configured Google Maps credentials.',
  )
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1792, height: 861 })
  await page.goto('/game/singleplayer')
  const exitTutorial = page.getByRole('button', { name: 'Exit tutorial' })
  try {
    await exitTutorial.waitFor({ state: 'visible', timeout: 8_000 })
    await exitTutorial.click()
  } catch {
    // Already seen in this profile this run; nothing to dismiss.
  }
  await page.getByRole('radio', { name: /Hard/ }).click()
  await page.getByRole('button', { name: 'Start exploring' }).click()
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({
    timeout: 45_000,
  })
  // Hard difficulty: core weather is visible without collapsing (R06).
  const panel = page.getByRole('complementary', {
    name: 'Geographic intelligence',
  })
  const toggle = panel.getByRole('button', {
    name: /GEOGRAPHIC INTELLIGENCE/,
  })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(panel.getByText(/°C/)).toBeVisible()
  // Hard difficulty: free map placement, not a list.
  await expect(page.getByTestId('candidate-option')).toHaveCount(0)
  const world = page.locator('.sp-guess-panel .sp-google-map')
  await expect(world.locator('img').first()).toBeVisible({ timeout: 15_000 })
  await world.click({ position: { x: 220, y: 160 } })
  await expect(
    page.getByRole('button', { name: 'Guess', exact: true }),
  ).toBeEnabled()
})
