# Singleplayer tutorial redesign

Verified locally on 2026-11-21. Changes have not been pushed.

## Design

The tutorial now has one compact Field Guide card. A soft SVG scrim with a rounded transparent cutout and one lime outline draws attention to the actual gameplay element. There is no duplicated Geographic Intelligence panel or practice map during an active round, and there is no page-wide blur. The previous standalone tutorial header, indicator chips, nested practice surfaces and labeled stepper have been removed.

Each step contains a title, a short explanation and one takeaway. Five small progress marks support direct step navigation. Next is primary; Previous is subdued; Skip and Restart are quiet text controls within the card. Formula details are collapsed by default.

## Architecture

- `Tutorial.tsx` owns the five steps, optional pre-game examples, focus containment/restoration and the visual spotlight. `useSpotlight` measures real target bounds and the card, places the card in available space, and observes resizing, scrolling, asynchronous mounting and content changes.
- `SingleplayerGamePage.tsx` supplies the round/result and active tutorial step. Temporary presentation overrides reveal a collapsed weather or map panel without overwriting the player's expanded/collapsed preferences.
- `GeographicIntelligence.tsx` temporarily expands the **existing** panel. On phones the same panel is revealed above the guide; a second weather instance is never mounted. The unused embedded tutorial rendering path was removed.
- `GameResults.tsx` exposes stable distance and points anchors on the actual round result.
- `Tutorial.css` defines the scrim, card and responsive target presentation. Narrow layouts reserve space using the measured card height. Short windows and browser zoom scroll only the card's content while navigation, Skip and Restart stay available.
- The modal keeps the live game controls inactive during the walkthrough, so following the guide cannot accidentally submit a guess. The copy makes the subsequent map action explicit. The panorama and map stay mounted, and their interactions resume on exit.
- When no live round exists, small, explicitly labeled examples live **inside the same card**. Optional shortlist/map practice cannot create a game or submit a real guess. Missing Maps supports coordinate entry.
- Distance uses an inline London–Paris example before results are available; an actual result is spotlighted afterward. Points highlights the live HUD or actual round points. Its labeled example slider uses the same scoring function as the backend.

## Required content retained

| Step | Teaching point | Real target / example |
| --- | --- | --- |
| 1. Weather | Temperature, precipitation, humidity and wind as climate/location clues; weather is not proof and imagery can be older | Actual Geographic Intelligence panel; compact example before a game |
| 2. Location | Easy shortlist; Medium map with borders; Hard map without borders; pan/zoom; place or change a pin | Actual shortlist/map |
| 3. Submission | A selection is not a submission; Guess locks the answer | Actual Guess button |
| 4. Distance | Actual location revealed after submission; geographic coordinates; Haversine distance in km with one decimal | Actual distance result, or labeled 343.6 km London–Paris example |
| 5. Points | Shorter distance means more points; up to 5,000 per round; unlimited rounds; Next round and End Game summary | Actual points/HUD plus a labeled scoring example |

Checked against requirements 3, 7–11 and 14 in `docs/requirements/Software-Engineering_Anforderungsanalyse.pdf`.

## Files changed for this task

Production:

- `frontend/src/pages/singleplayer/Tutorial.tsx`
- `frontend/src/pages/singleplayer/Tutorial.css`
- `frontend/src/pages/singleplayer/SingleplayerGamePage.tsx` — tutorial integration and temporary panel presentation
- `frontend/src/pages/singleplayer/GeographicIntelligence.tsx` — reveal the real panel and remove the obsolete embedded copy
- `frontend/src/pages/singleplayer/GameResults.tsx` — actual result anchors

Verification:

- `frontend/src/pages/singleplayer/Tutorial.test.tsx`
- `frontend/src/pages/singleplayer/SingleplayerTutorial.test.tsx`
- `e2e/tutorial.spec.ts`
- `e2e/tutorial.live.spec.ts`
- This README and the PNGs in this directory

Concurrent navigation, session-summary and other edits present in the shared workspace were preserved; they are not tutorial redesign changes.

## Verification results

- `npm test --prefix frontend`: **127 tests passed across 19 files**.
- `npm run build --prefix frontend`: **passed** (TypeScript and production Vite build). Vite retains its large-chunk advisory for the existing 3D bundle.
- `npm run lint --prefix frontend`: **passed with warnings**. Warnings concern existing mixed component/helper exports, render-time `Date.now` and state updates in effects; no lint errors.
- WebStorm project build: **successful**; IDE reports limited build diagnostics. The CLI production build above supplies the actual compiler verification.
- `npx playwright test e2e/tutorial.spec.ts`: **10 tests passed**.
- `TERRAGUESSR_LIVE_MAPS=1 TERRAGUESSR_TUTORIAL_SCREENSHOTS=1 npx playwright test e2e/tutorial.live.spec.ts`: **3 tests passed** using the real backend, Google Maps tiles and Street View, without provider doubles.

The browser checks exercise opening automatically and from the home/game menus; all five steps; Previous/Next/direct progression; finishing; Skip and Escape; Restart and reopening; keyboard focus containment and restoration; preserved panorama, pin, score and difficulty; no tutorial gameplay mutations; and a real guess, score result and next round after completion. Easy shortlist selection and the Hard borderless map are exercised after exit. The small-phone check verifies that all four real weather readings fit inside the highlighted panel.

The responsive matrix checks all five steps for one card, reachable controls, no horizontal overflow, and no overlap with the spotlight: **320×720, 375×812, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080 and 844×390**. A separate Chromium check uses actual **200% browser zoom**. Mobile live verification uses a touch-enabled 390×844 context and also checks 320×720.

## Screenshots

Before captures use the original `HEAD` implementation in a temporary separate local checkout. After captures use the current application. Both use genuine Google imagery and loaded map tiles; locations differ because rounds are randomized. No mobile capture enlarges the viewport to hide scrolling or clipping.

| View | Before | After |
| --- | --- | --- |
| Desktop 1440×900 | [Original](before/desktop.png) | [Weather](after/desktop-weather.png) |
| Mobile 390×844 | [Original](before/mobile.png) | [Weather](after/mobile-weather.png) |

Additional after screenshots:

- Desktop: [Location](after/desktop-location.png), [Guess](after/desktop-confirmation.png), [Distance example](after/desktop-distance.png), [Points](after/desktop-points.png)
- Actual round results: [Distance](after/desktop-real-distance.png), [Points](after/desktop-real-points.png)
- Difficulty inputs: [Easy shortlist](after/desktop-location-easy.png), [Hard map](after/desktop-location-hard.png)
- Mobile: [Location](after/mobile-location.png), [Guess](after/mobile-confirmation.png), [Distance](after/mobile-distance.png), [Points](after/mobile-points.png)
- [Small phone weather, 320×720](after/mobile-small-weather.png)
