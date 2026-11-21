import { expect, test } from '@playwright/test'

test('How to play opens from the main nav without starting a game', async ({ page }) => {
  const gameRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/singleplayer/')) gameRequests.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('link', { name: 'How to play' }).first().click()
  await expect(page).toHaveURL('/how-to-play')
  await expect(page.getByRole('heading', { name: 'Become a master explorer' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(gameRequests).toEqual([])
})

test('the tutorial is reachable, steps through all five beats, and is skippable/restartable (R14)', async ({ page }) => {
  await page.goto('/how-to-play')
  const start = page.getByRole('button', { name: 'Start interactive tutorial' })
  await start.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Step 1 / 5')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Read the weather' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()

  const expectedTitles = [
    'Pick a location',
    'Submit your guess',
    'Measuring distance',
    'Score by distance',
  ]
  for (const title of expectedTitles) {
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }

  // Last step shows the interactive scoring demo, driven by the same curve
  // as a real round (R10): 0 km -> 5000, 2000 km -> 4522, 20000 km -> 0.
  const slider = page.getByRole('slider', { name: 'Example distance in kilometers' })
  for (const [distance, score] of [
    ['0', '5,000'],
    ['2000', '4,522'],
    ['20000', '0'],
  ]) {
    await slider.fill(distance!)
    await expect(page.getByLabel('Example score')).toContainText(`${score} / 5,000 pts`)
  }

  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(dialog).toBeHidden()

  // Restart: reopening always starts from step 1, not wherever it was left.
  await start.click()
  await expect(page.getByText('Step 1 / 5')).toBeVisible()

  // Skip: exits the tutorial from any step without finishing it.
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(dialog).toBeHidden()
})

test('the distance example shows the real London-Paris great-circle distance', async ({ page }) => {
  await page.goto('/how-to-play')
  await page.getByRole('button', { name: 'Start interactive tutorial' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Measuring distance' })).toBeVisible()
  await expect(page.getByText('London')).toBeVisible()
  await expect(page.getByText('Paris')).toBeVisible()
  await expect(page.getByText(/34[0-9] km/)).toBeVisible()
})

for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [320, 568],
]) {
  test(`how-to-play remains readable at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! })
    await page.goto('/how-to-play')
    await expect(page.getByRole('heading', { name: 'Become a master explorer' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Start interactive tutorial' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
