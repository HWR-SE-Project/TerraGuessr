import type { Page } from '@playwright/test'

/** Setup has one page action; an active session exits through its shared menu. */
export async function requestGameExit(page: Page) {
  const home = page.getByRole('link', { name: 'Return Home', exact: true })
  if (await home.isVisible()) return home.click()
  await page.getByRole('button', { name: 'Game menu', exact: true }).click()
  await page.getByRole('button', { name: 'Exit Game', exact: true }).click()
}
