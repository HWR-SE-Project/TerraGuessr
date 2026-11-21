import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

test('live geographic intelligence: protected data, desktop states, movement and narrow viewports', async ({
  page,
}) => {
  test.skip(
    process.env.TERRAGUESSR_LIVE_MAPS !== '1',
    'Requires live Google Maps credentials and backend.',
  )
  test.setTimeout(120_000)
  const out = 'docs/screenshots/intelligence'
  await mkdir(out, { recursive: true })
  const errors: string[] = []
  page.on('pageerror', (error) =>
    errors.push(error.message.replace(/AIza[\w-]+/g, '[REDACTED]')),
  )
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/intelligence'))
      calls.push(new URL(request.url()).pathname)
  })
  await page.setViewportSize({ width: 1792, height: 861 })
  await page.goto('/game/singleplayer')
  const received = page.waitForResponse((r) =>
    r.url().endsWith('/intelligence'),
  )
  await page.getByRole('button', { name: 'Start exploring' }).click()
  await expect(page.locator('.sp-panorama[data-ready="true"]')).toBeVisible({
    timeout: 45_000,
  })
  const response = await received
  expect(response.ok()).toBe(true)
  const data = await response.json()
  expect(Object.keys(data).sort()).toEqual([
    'cached',
    'climate',
    'environment',
    'fetchedAt',
    'weather',
  ])
  expect(JSON.stringify(data)).not.toMatch(
    /"(?:lat|lon|latitude|longitude|city|country|region|timezone|address|postal|panoId)"/i,
  )
  expect(data.weather?.temperatureC).not.toBeNull()
  expect(data.environment.elevationM).not.toBeNull()
  await expect(page.locator('.gi-loading')).toHaveCount(0)
  const panel = page.getByRole('complementary', {
    name: 'Geographic intelligence',
  })
  const toggle = panel.getByRole('button', { name: /GEOGRAPHIC INTELLIGENCE/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(
    panel.getByRole('region', { name: 'Environment', exact: true }),
  ).toBeVisible()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${out}/desktop-expanded.png` })
  // Desktop panel stays left, clear of the bottom compass and right guessing map.
  const bounds = await panel.boundingBox()
  const compass = await page.locator('.sp-compass').boundingBox()
  const brand = await page.getByRole('link', { name: 'TerraGuessr home', exact: true }).boundingBox()
  expect(bounds!.y).toBeGreaterThan(brand!.y + brand!.height)
  expect(bounds!.y - brand!.y - brand!.height).toBeLessThanOrEqual(20)
  expect(bounds!.width).toBe(280)
  expect(bounds!.x + bounds!.width).toBeLessThan(1792 / 3)
  if (compass)
    expect(
      bounds!.x > compass.x + compass.width ||
        bounds!.y + bounds!.height < compass.y,
    ).toBe(true)
  const zoom = await page
    .locator('.sp-panorama button[aria-label="Zoom in"]')
    .boundingBox()
  if (zoom) expect(bounds!.x).toBeGreaterThan(zoom.x + zoom.width)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.waitForTimeout(350)
  const compactBounds = (await panel.boundingBox())!
  expect(compactBounds.height).toBeLessThan(100)
  expect(compactBounds.x).toBe(brand!.x)
  expect(compactBounds.y).toBe(bounds!.y)
  await page.screenshot({ path: `${out}/desktop-collapsed.png` })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const requestCountBeforeMovement = calls.length
  const viewer = page.locator('.sp-panorama')
  const heading = await viewer.getAttribute('data-heading')
  await page.mouse.move(650, 350)
  await page.mouse.down()
  await page.mouse.move(900, 350, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => viewer.getAttribute('data-heading')).not.toBe(heading)
  const pano = await viewer.getAttribute('data-panorama')
  await viewer.getByRole('button', { name: /^Go / }).first().click()
  await expect
    .poll(() => viewer.getAttribute('data-panorama'), { timeout: 15_000 })
    .not.toBe(pano)
  expect(calls).toHaveLength(requestCountBeforeMovement)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toBeVisible()
  await page.screenshot({ path: `${out}/mobile-expanded.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  )
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}/mobile-collapsed.png` })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  // The panel unmounts on scoring and remounts with the next round's data.
  await page.setViewportSize({ width: 1792, height: 861 })
  await page.getByRole('button', { name: 'Expand map', exact: true }).click()
  await page
    .locator('.sp-guess-panel .sp-google-map')
    .click({ position: { x: 220, y: 160 } })
  await page.getByRole('button', { name: 'Guess', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Round results' }),
  ).toBeVisible()
  await expect(page.locator('.gi-panel')).toHaveCount(0)
  const nextClues = page.waitForResponse((response) =>
    response.url().endsWith('/intelligence'),
  )
  await page.getByRole('button', { name: 'Next round', exact: true }).click()
  expect((await nextClues).ok()).toBe(true)
  await expect(page.locator('.gi-panel .gi-header')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(page.locator('.gi-loading')).toHaveCount(0)
  expect(new Set(calls).size).toBe(2)
  for (const width of [320, 390, 700, 701, 768, 1024, 1792]) {
    await page.setViewportSize({ width, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  }
  expect(errors).toEqual([])
  await writeFile(
    `${out}/verification.json`,
    JSON.stringify(
      {
        desktop: '1792×861',
        mobile: '390×844',
        currentModelAvailable: Boolean(data.weather),
        elevationAvailable: data.environment.elevationM !== null,
        noAnswerFields: true,
        panoramaMovement: true,
        roundReset: true,
        responsiveWidths: [320, 390, 700, 701, 768, 1024, 1792],
        errors,
      },
      null,
      2,
    ) + '\n',
  )
})
