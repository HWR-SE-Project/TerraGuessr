import { expect, test } from '@playwright/test'

test('Help opens a standalone guide without initializing a game', async ({ page }) => {
  const gameRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/singleplayer/')) gameRequests.push(request.url())
  })
  await page.goto('/auth')
  await page.getByRole('link', { name: 'How to play' }).filter({ visible: true }).click()
  await expect(page).toHaveURL('/how-to-play')
  await expect(page).toHaveTitle('How to play · TerraGuessr')
  await expect(page.getByRole('heading', { name: 'How to play.' })).toBeVisible()
  for (const name of ['Look around', 'Follow the clues', 'Choose your location', 'Make your guess']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(gameRequests).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'How to play.' })).toBeVisible()
})

test('legacy tutorial URLs redirect to the guide and the play link opens setup', async ({ page }) => {
  await page.route('**/api/singleplayer/config', route => route.fulfill({ json: { available: true, provider: 'google', serverKeyConfigured: true } }))
  await page.goto('/game/singleplayer?tutorial=1')
  await expect(page).toHaveURL('/how-to-play')
  await page.getByRole('link', { name: 'Let’s explore' }).click()
  await expect(page).toHaveURL('/game/singleplayer')
  await expect(page.getByRole('button', { name: /Start exploring/i })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL('/how-to-play')
})

test('the score example uses the game scoring curve and works from the keyboard', async ({ page }) => {
  await page.goto('/how-to-play')
  const slider = page.getByRole('slider', { name: 'Example distance in kilometers' })
  for (const [distance, score] of [['0', '5,000'], ['2000', '4,522'], ['20000', '0']]) {
    await slider.fill(distance!)
    await expect(page.getByLabel('Example score')).toContainText(`${score} / 5,000 pts`)
  }
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(page.getByLabel('Example score')).toContainText('5,000 / 5,000 pts')
})

for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
  test(`guide remains readable at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! })
    await page.goto('/how-to-play')
    await expect(page.getByRole('heading', { name: 'How to play.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const play = page.getByRole('link', { name: 'Let’s explore' })
    await play.scrollIntoViewIfNeeded()
    await expect(play).toBeInViewport()
    const menu = page.getByRole('button', { name: 'Open navigation' })
    if (await menu.isVisible()) {
      await menu.click()
      await expect(page.getByRole('link', { name: 'How to play' }).filter({ visible: true })).toHaveAttribute('href', '/how-to-play')
    }
  })
}
