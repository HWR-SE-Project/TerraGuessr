import { expect, test } from '@playwright/test'
import { registerAndLogin } from './support/game'

test('home opens the avatar editor and restores keyboard focus', async ({
  page,
}) => {
  await registerAndLogin(page, 'Home Explorer')
  await expect(
    page.getByRole('heading', { name: 'Explore the World' }),
  ).toBeVisible()
  const editAvatar = page.getByRole('button', { name: 'Edit Avatar' })
  await editAvatar.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'A world of you.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(editAvatar).toBeFocused()
  await expect(page.locator('.th-profile-name')).toHaveText('Home Explorer')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
})

test('mobile navigation and game entry points stay usable without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create a Lobby', exact: true }).click()
  await expect(page).toHaveURL(/\/multiplayer\/create$/)
  await expect(page.getByRole('heading', { name: 'Create a lobby' })).toBeVisible()
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  for (const width of [320, 390, 768, 1024, 1280, 1711]) {
    await page.setViewportSize({ width, height: 864 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    const collapsed = width <= 1200
    if (collapsed) await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(
      nav.getByRole('link', { name: 'Singleplayer', exact: true }),
    ).toBeVisible()
    if (collapsed) await page.keyboard.press('Escape')
  }
  await nav.getByRole('link', { name: 'Singleplayer', exact: true }).click()
  await expect(
    page.getByRole('main', { name: 'TerraGuessr singleplayer game' }),
  ).toBeVisible()
})

test('Multiplayer navigation opens either lobby form directly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('menuitem', { name: 'Create a Lobby', exact: true }).click()
  await expect(page).toHaveURL(/\/multiplayer\/create$/)
  await expect(page.getByRole('heading', { name: 'Create a lobby' })).toBeVisible()
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Join a Lobby', exact: true }).click()
  await expect(page).toHaveURL(/\/multiplayer\/join$/)
  await expect(page.getByRole('heading', { name: 'Join a lobby' })).toBeVisible()
})
