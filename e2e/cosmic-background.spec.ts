import { expect, test } from '@playwright/test'

test('one non-interactive cosmic canvas survives Home, Auth, Multiplayer and back navigation', async ({ page }) => {
  await page.goto('/')
  const sky = page.locator('.cosmic-background')
  const canvas = sky.locator('canvas')
  await expect(sky).toHaveAttribute('data-ready', 'true')
  await expect(canvas).toHaveCount(1)
  await expect(sky).toHaveCSS('pointer-events', 'none')
  await canvas.evaluate(element => { element.dataset.persistenceCheck = 'original' })
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/auth$/)
  await expect(canvas).toHaveAttribute('data-persistence-check', 'original')
  await page.getByRole('button', { name: 'Continue with Email' }).click()
  await page.getByLabel('Email', { exact: true }).fill('explorer@example.test')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('explorer@example.test')
  await page.getByRole('link', { name: 'TerraGuessr home', exact: true }).click()
  await expect(page.locator('[data-character-status]')).toHaveAttribute('data-character-status', 'ready')
  await expect(canvas).toHaveAttribute('data-persistence-check', 'original')
  await page.getByRole('button', { name: 'Multiplayer', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create a Lobby', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create a lobby', exact: true })).toBeVisible()
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toHaveAttribute('data-persistence-check', 'original')
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Edit Avatar' })).toBeVisible()
  await expect(canvas).toHaveAttribute('data-persistence-check', 'original')
})

test('WebGL unavailability preserves the Home fallback and working authentication', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (/webgl/.test(type)) return null
      return Reflect.apply(getContext, this, [type, ...args])
    } as typeof getContext
  })
  await page.goto('/')
  await expect(page.locator('[data-character-status]')).toHaveAttribute('data-character-status', 'error')
  await expect(page.locator('.th-earth img')).toBeVisible()
  await expect(page.locator('.cosmic-background canvas')).toHaveCount(0)
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with Email' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('explorer@example.test')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('explorer@example.test')
})
