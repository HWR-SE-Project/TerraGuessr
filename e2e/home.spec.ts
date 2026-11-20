import { expect, test } from '@playwright/test'
import { registerAndLogin } from './support/game'

test('home retains its availability notice and restores keyboard focus', async ({
  page,
}) => {
  await registerAndLogin(page, 'Home Explorer')
  await expect(
    page.getByRole('heading', { name: 'Explore the World' }),
  ).toBeVisible()
  const editAvatar = page.getByRole('button', { name: 'Edit Avatar' })
  await editAvatar.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toContainText(
    'Avatar customization is not available',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(editAvatar).toBeFocused()
  await expect(page.locator('.th-profile-name')).toHaveText('Home Explorer')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Daily activities' })).toHaveCount(0)
})

test('mobile navigation and game entry points stay usable without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await registerAndLogin(page, 'Mobile Explorer')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Multiplayer', exact: true }).click()
  await expect(page).toHaveURL(/\/multiplayer$/)
  await expect(page.getByRole('heading', { name: 'Multiplayer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create a lobby' })).toBeVisible()
  await page.goto('/')
  for (const width of [320, 390, 768, 1024, 1280, 1711]) {
    await page.setViewportSize({ width, height: 864 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    await expect(
      page.getByRole('link', { name: 'Play Solo Challenge yourself' }),
    ).toBeVisible()
  }
  await page.getByRole('link', { name: 'Play Solo Challenge yourself' }).click()
  await expect(
    page.getByRole('main', { name: 'TerraGuessr singleplayer game' }),
  ).toBeVisible()
})

test('Play Together opens the multiplayer lobby hub', async ({ page }) => {
  await registerAndLogin(page, 'Lobby Explorer')
  await page.getByRole('link', { name: 'Play Together With friends' }).click()
  await expect(page).toHaveURL(/\/multiplayer$/)
  await expect(page.getByRole('heading', { name: 'Multiplayer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create a lobby' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Join a lobby' })).toBeVisible()
})

test('daily API failure leaves home and its navigation usable', async ({
  page,
}) => {
  await registerAndLogin(page, 'Offline Explorer')
  await page.route('**/api/daily/today', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UNAVAILABLE', message: 'Temporary outage' },
      }),
    }),
  )
  await page.reload()
  await expect(page.getByRole('complementary', { name: 'Daily activities' })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Explore the World' }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: 'Compete Climb the leaderboards' })
    .click()
  await expect(page).toHaveURL(/\/duels$/)
})

test('Play Solo opens Street View and the legacy weather expedition remains playable', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await registerAndLogin(page, 'Home Solo Explorer')
  await page.getByRole('link', { name: 'Play Solo Challenge yourself' }).click()
  await expect(page).toHaveURL(/\/game\/singleplayer$/)
  await expect(page.getByRole('main', { name: 'TerraGuessr singleplayer game' })).toBeVisible()
  await page.goto('/play')
  await page.getByRole('button', { name: 'Medium', exact: true }).click()
  await page.getByRole('button', { name: 'Click the map' }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Start playing' }).click()
  for (let round = 1; round <= 3; round += 1) {
    await expect(page.getByTestId('weather-panel')).toBeVisible({
      timeout: 30_000,
    })
    await page.locator('.tg-map-picker').click({ position: { x: 150, y: 130 } })
    await page.getByRole('button', { name: 'Submit guess' }).click()
    await expect(page.locator('.tg-play-result-score-value')).toBeVisible()
    await page
      .getByRole('button', {
        name: round === 3 ? 'View summary' : 'Next round',
      })
      .click()
  }
  await expect(page.getByText('Expedition complete')).toBeVisible()
  await expect(page.locator('.tg-play-summary-row')).toHaveCount(3)
})

test('Duels creates a real challenge that a friend can play', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  await registerAndLogin(page, 'Home Duel Explorer')
  await page.goto('/duels')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByText('Where is this?')).toBeVisible()
  await page
    .locator('.tg-duel-overlay-map .tg-map-picker')
    .click({ position: { x: 150, y: 130 } })
  await page
    .getByRole('button', { name: 'Lock in guess & create duel link' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Beat this location' }),
  ).toBeVisible()
  await expect(page.getByText(/challenge created/i)).toBeVisible()
  const friend = await browser.newContext()
  try {
    const friendPage = await friend.newPage()
    await friendPage.goto(page.url())
    await friendPage
      .getByRole('button', { name: 'Play this challenge' })
      .click()
    await expect(friendPage.getByTestId('weather-panel')).toBeVisible({
      timeout: 30_000,
    })
    await friendPage.getByTestId('candidate-option').first().click()
    await friendPage.getByRole('button', { name: 'Submit guess' }).click()
    await expect(friendPage.locator('.tg-challenge-result-score')).toBeVisible()
    await friendPage
      .getByLabel('Name on the leaderboard (optional)')
      .fill('Home Friend Explorer')
    await friendPage.getByRole('button', { name: 'Add to leaderboard' }).click()
    await expect(
      friendPage.locator('.tg-challenge-leaderboard-list'),
    ).toContainText('Home Friend Explorer')
  } finally {
    await friend.close()
  }
})
