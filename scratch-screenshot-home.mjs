import { chromium } from 'playwright-core'
import path from 'node:path'

const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/3c255331-8b5a-48a1-9c16-a27d40b4bf49/scratchpad/figma'

async function signUpAndScreenshot(ctx, screenshotName) {
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.getByRole('button', { name: 'Sign up' }).first().click()
  const emailProvider = page.getByRole('button', { name: 'Continue with Email' })
  if (await emailProvider.isVisible().catch(() => false)) {
    await emailProvider.click()
  }
  const email = `home-check-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  await page.getByLabel('Display name').fill('HomeCheck')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: false }).fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('Play a round').first().waitFor({ state: 'attached', timeout: 15000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, screenshotName), fullPage: true })
  return page
}

async function main() {
  const browser = await chromium.launch()

  const desktopCtx = await browser.newContext({ viewport: { width: 1920, height: 2400 } })
  await signUpAndScreenshot(desktopCtx, 'actual-desktop.png')
  await desktopCtx.close()

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 1240 } })
  await signUpAndScreenshot(mobileCtx, 'actual-mobile.png')
  await mobileCtx.close()

  await browser.close()
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) })
