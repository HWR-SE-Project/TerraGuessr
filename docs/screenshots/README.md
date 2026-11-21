# Browser evidence

Captured from the running application using Chromium against an isolated Docker Compose stack with deterministic test weather.

- `phase1-desktop-home.png` — 1440px landing page.
- `phase1-desktop-game.png` — 1440px Easy mode with five distinguishable choices.
- `phase1-desktop-map.png` — 1440px Hard mode after placing a map marker.
- `phase1-mobile-home.png` — 375px landing page.
- `phase1-mobile-game.png` — 375px Easy mode.
- The current Phase 1 game captures include optional Open-Meteo pressure and wind direction with provider attribution; the “Sun & local time” panel is expanded in mobile gameplay.
- `phase2-desktop-dashboard.png` — 1440px authenticated dashboard after email registration.
- `phase2-mobile-settings-de.png` — 375px settings page with the persisted German interface preference.
- `phase3-mobile-setup.png` — 390px game setup with the configurable solo round count.
- `phase3-mobile-attempt-result.png` — 390px intermediate attempt feedback with the answer still hidden.
- `phase4-daily-dashboard.png` — 1440px authenticated dashboard with the shared UTC challenge.
- `phase4-daily-game.png` — 1440px Daily Challenge with Open-Meteo values and map guessing.
- `phase4-daily-result.png` — 1440px submitted result, revealed location and persisted daily placement.
- `phase4-daily-statistics.png` — 1440px account-owned Daily history and average score/distance.
- `phase4-daily-leaderboard.png` — 1440px date-selectable Daily leaderboard and current placement.
- `phase4-mobile-daily-leaderboard.png` — 375px Daily leaderboard layout with no page overflow.

The isolated browser environment does not guarantee external OpenStreetMap tile access; a blank
tile layer in its game capture is a provider/network limitation, while map selection and guess
submission remain covered by browser interaction tests.

## Requirement 14 Singleplayer tutorial

Verified on 20 November 2026 against the production frontend preview at `http://localhost:8086`, using the running backend, real Google Maps, real Street View and real model weather. The tutorial works from the Home menu, the Singleplayer game menu and the persistent information button. Manual launches do not create or reset a game.

| Section | Browser evidence | Interaction |
| --- | --- | --- |
| Main menu | [Home entry](tutorial/00-main-menu.png), [game menu entry](tutorial/00-game-menu.png) | Start the tutorial before or during a game |
| Weather | [Weather clues](tutorial/01-weather.png) | Select temperature, precipitation, humidity or wind to highlight its value in the reused Geographic Intelligence panel; wind is converted from km/h to m/s |
| Location | [Easy list](tutorial/02-location-easy.png), [Medium map](tutorial/02-location-medium.png), [Hard map](tutorial/02-location-hard.png) | Change a list selection or place and move a practice pin; Medium keeps borders, Hard hides country and province boundaries |
| Confirmation | [Confirmed practice answer](tutorial/03-confirmation.png) | The shared Guess button requires a selection, locks the practice answer and offers Try again |
| Distance | [Haversine example](tutorial/04-distance.png) | London and Paris markers, a connecting geodesic and 343.6 km; expand the formula for latitude and longitude in radians |
| Points | [Interactive score example](tutorial/05-points.png) | Change distance with the slider; 2,000 km gives 4,522 points using the game's actual scoring function |
| Mobile | [Weather](tutorial/06-mobile-weather.png), [touch selection](tutorial/06-mobile-location.png) | Scrollable guidance with reachable navigation, Exit and Restart; captures show the full scrollable section |

The tutorial uses the same pure Haversine and scoring functions as the backend. Steps 2–3 include an in-card practice location list and a try-out guess submission, and the points step has an interactive distance slider. Its practice selections, confirmation lock and score calculator live only in tutorial state. Exit, Escape and Finish dismiss the guide; Restart clears that practice state and returns to Weather. No tutorial action changes the live score, difficulty, round, saved pin or session. The live panorama stays mounted. Maps receives a separate inner panorama canvas so provider styling cannot collapse the gameplay viewport.

The temporary `ALWAYS_SHOW_SINGLEPLAYER_TUTORIAL = true` flag remains in `Tutorial.tsx`: every explicit new game opens the guide even after a previous finish or exit. Reopening the menu and next-round transitions do not invoke it (Singleplayer no longer supports resuming an exited session at all — see the endless-mode changes). Completion tracking never gates manual menu access.

### Verification results

- Frontend unit and component integration suite: **127 passed** across 19 files (`npm test --prefix frontend`). This includes tutorial content, all five exit/restart steps, three difficulty modes, weather fallback, score examples, one-decimal distance display and game-session preservation.
- Backend unit suite: **248 passed** (`npm test --prefix backend`).
- Applicable PostgreSQL integration suite: **22 passed** (`backend/node_modules/.bin/vitest run test/integration/singleplayer.integration.test.ts --no-file-parallelism`, run from `backend` with `DATABASE_URL` pointing at a disposable PostgreSQL on port 55438). The initial default database port was unavailable; the successful run used the isolated database.
- Requirement 14 Playwright suites: **12 passed** (`tutorial.spec.ts` and `tutorial.live.spec.ts`). Nine deterministic/offline tests and three real-provider tests cover menu launch, all subjects, difficulty adaptation, safe confirmation, exit/restart, unchanged session/marker/panorama, touch, reduced motion and actual Chromium browser zoom at 200%.
- Responsive checks: widths **320, 390, 640, 768 and 1024**; live desktop at 1440; touch at 390 × 844. The zoom test changes Chromium's actual Page zoom setting in a disposable browser profile and verifies device pixel ratio 2 and effective viewport width 640.
- Production build, TypeScript and `git diff --check`: passed. Lint exits successfully with existing Fast Refresh and React warnings; Vite retains its existing large-chunk warning.

To reproduce the browser checks against a running frontend and configured backend:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:8086 TERRAGUESSR_LIVE_MAPS=1 TERRAGUESSR_TUTORIAL_SCREENSHOTS=1 npx playwright test e2e/tutorial.spec.ts e2e/tutorial.live.spec.ts
```

`TERRAGUESSR_TUTORIAL_SCREENSHOTS=1` writes this gallery. Without that flag, captures go to Playwright's test output. Live tests are opt-in; the deterministic suite explicitly doubles unavailable providers and backend responses rather than claiming those checks use real imagery.

### Limitations

The backend currently supplies six Easy-mode candidates. The tutorial deliberately uses four labeled example locations and explains that a real shortlist may contain more; no correct candidate is removed from the real game. Before a round exists, or if weather is incomplete, the reused panel shows labeled example values. If Google Maps is unavailable, a labeled coordinate grid and keyboard coordinate inputs support practice; geographic imagery, pan and zoom require the provider. No current-round answer is read or revealed by the tutorial. Browser verification used Chromium; Safari and Firefox were not exercised.
