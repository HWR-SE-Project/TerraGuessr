import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const out = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1792, height: 861 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto(`${base}/game/singleplayer`)
await page
  .getByText('Street View is currently unavailable', { exact: true })
  .waitFor()
await page.screenshot({
  path: path.join(out, 'desktop-unavailable-1792x861.png'),
})
await page.getByRole('button', { name: 'Expand map', exact: true }).click()
await page.mouse.move(600, 100)
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(out, 'expanded-map-unavailable.png') })
await page.getByRole('button', { name: 'Game settings' }).click()
await page.screenshot({ path: path.join(out, 'settings.png') })
await page.keyboard.press('Escape')
await page.setViewportSize({ width: 390, height: 844 })
await page.reload()
await page
  .getByText('Street View is currently unavailable', { exact: true })
  .waitFor()
await page.screenshot({
  path: path.join(out, 'mobile-unavailable-390x844.png'),
})
await page.getByRole('button', { name: 'Expand map', exact: true }).click()
await page.waitForTimeout(300)
await page.screenshot({
  path: path.join(out, 'mobile-expanded-map-unavailable.png'),
})
const responsive = []
for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1792, 861],
  [844, 390],
]) {
  await page.setViewportSize({ width, height })
  await page.reload()
  await page
    .getByText('Street View is currently unavailable', { exact: true })
    .waitFor()
  responsive.push(
    await page.evaluate(() => {
      const bounds = (selector) =>
        document.querySelector(selector).getBoundingClientRect().toJSON()
      return {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        brand: bounds('.sp-brand'),
        controls: bounds('.sp-top-controls'),
        map: bounds('.sp-guess-panel'),
        hud: bounds('.sp-hud'),
        welcome: bounds('.sp-welcome'),
      }
    }),
  )
}
// Isolated visual fixtures only. No provider/API success is simulated and no
// fixture data is available to the production page. The warning is in-image.
await page.setViewportSize({ width: 1792, height: 861 })
async function resultFixture(final) {
  await page.goto(`${base}/game/singleplayer`)
  await page
    .getByText('Street View is currently unavailable', { exact: true })
    .waitFor()
  await page.evaluate(async (final) => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default
    const { createRoot } = (
      await import('/node_modules/.vite/deps/react-dom_client.js')
    ).default
    const { RoundResults, FinalResults } = await import(
      '/src/pages/singleplayer/GameResults.tsx'
    )
    const results = [4250, 3190, 4990, 2750, 3980].map((score, index) => ({
      roundId: `visual-fixture-${index}`,
      number: index + 1,
      score,
      distanceKm: [325, 899, 4, 1195, 456][index],
      guess: { lat: 48.85 + index, lon: 2.35 + index },
      actual: { lat: 51.5 + index, lon: -0.12 + index },
    }))
    const host = document.createElement('div')
    host.className = 'sp-page'
    document.body.appendChild(host)
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              top: 20,
              width: '100%',
              textAlign: 'center',
              color: '#ffd587',
              fontSize: 13,
              fontFamily: 'system-ui',
            },
          },
          'UI FIXTURE · illustrative results · live maps unavailable without credentials',
        ),
        final
          ? React.createElement(FinalResults, {
              session: {
                id: 'fixture',
                roundsTotal: 5,
                totalScore: results.reduce((s, r) => s + r.score, 0),
                results,
                completed: true,
                activeRound: null,
              },
              busy: false,
              onHome: () => {},
              onPlayAgain: () => {},
            })
          : React.createElement(RoundResults, {
              result: results[0],
              roundsTotal: 5,
              busy: false,
              onNext: () => {},
            }),
      ),
    )
  }, final)
  await page.waitForTimeout(250)
  await page.screenshot({
    path: path.join(
      out,
      final
        ? 'final-results-component-fixture.png'
        : 'round-results-component-fixture.png',
    ),
  })
}
await resultFixture(false)
await resultFixture(true)
await page.goto(`${base}/`)
await page.getByRole('heading', { name: 'Explore the World' }).waitFor()
await page.screenshot({ path: path.join(out, 'home-regression.png') })
await fs.writeFile(
  path.join(out, 'browser-results.json'),
  JSON.stringify(
    {
      base,
      referenceAvailable: false,
      credentialsAvailable: false,
      resultScreenshots:
        'Explicitly labelled isolated component fixtures; not live gameplay.',
      errors,
      responsive,
    },
    null,
    2,
  ) + '\n',
)
console.log(
  JSON.stringify({
    errors,
    responsive: responsive.map((r) => ({
      width: r.width,
      height: r.height,
      scrollWidth: r.scrollWidth,
    })),
  }),
)
await browser.close()
