import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Real rendered pages/assets. Session summary and round imagery are captured
// separately by singleplayer.live.spec.ts using the actual Google provider.
test('shared navigation is consistent across discovery, account, setup and avatar screens', async ({ page }) => {
  test.setTimeout(90_000)
  const output = 'docs/screenshots/session-navigation'
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
  await page.screenshot({ path: `${output}/home.png` })
  await page.getByRole('button', { name: 'Edit Avatar' }).click()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeEnabled({ timeout: 30_000 })
  await page.screenshot({ path: `${output}/avatar-editor.png` })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Avatar' })).toBeFocused()
  for (const [name, path, heading] of [
    ['setup', '/game/singleplayer', 'The world is out there. Find your place.'],
    ['multiplayer', '/multiplayer', 'Multiplayer'],
    ['auth', '/auth', 'A little lost. A lot to discover.'],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.locator('.tg-page-nav')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'TerraGuessr home' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440)
    if (name === 'setup') await expect(page.getByText('Checking game availability…')).toBeHidden()
    await page.screenshot({ path: `${output}/${name}.png` })
  }
  await page.goto('/')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.th-character-slot')).toHaveAttribute('data-character-status', 'ready', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await page.screenshot({ path: `${output}/mobile-navigation.png`, fullPage: true })
})
