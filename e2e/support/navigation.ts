import type { Page } from '@playwright/test'

/** Setup has one page action; an active session exits through its shared menu. */
export async function requestGameExit(page: Page) {
  const menu = page.getByRole('button', { name: 'Game menu', exact: true })
  if (!await menu.isVisible()) return page.getByRole('link', { name: 'TerraGuessr home', exact: true }).click()
  await menu.click()
  await page.getByRole('button', { name: 'Exit Game', exact: true }).click()
}
