# Verification — 20 November 2026 (Anforderungsanalyse R01–R20 compliance)

This entry covers the Software-Engineering-Anforderungsanalyse compliance work: R03/R13
weather-gated selection with automatic fallback, R05 difficulty levels, R07 list-mode guessing,
R12 next-round prefetch, R14 tutorial, R18 durable 6-month result retention, plus verification
of the already-correct R01/R02/R04/R06/R08–R11/R15/R19/R20. See
[`docs/requirements/singleplayer-streetview-traceability.md`](../requirements/singleplayer-streetview-traceability.md)
for the full requirement-by-requirement matrix.

**Unit + integration (mocked doubles, deterministic):** backend 288/288 passing (37 files,
including five new files: `singleplayer-location-selection.test.ts`, `singleplayer-candidates.test.ts`,
`singleplayer-land.test.ts`, `game-purge.test.ts`, plus five new scenarios added to the existing
`singleplayer.integration.test.ts`). Frontend 72/72 passing (13 files, including three new:
`DifficultyPicker.test.tsx`, `Tutorial.test.tsx`, `CandidateList.test.tsx`). Both packages:
`tsc` clean, lint clean (oxlint/eslint, same pre-existing warning baseline as before this work),
production build clean.

**Real-provider verification (no mocking — actual Google Street View, Maps JS, and Open-Meteo),
rebuilt backend container, `npm run maps:doctor` passed first:**

- `e2e/singleplayer.live.spec.ts` ("Home to five rounds, final results, new game, and Home"):
  **passed** (real five-round game, real distance/score formula verified against the response,
  real Play Again, real Return Home).
- `e2e/singleplayer-difficulty.live.spec.ts` (new): **passed**, both scenarios — easy difficulty's
  6-option named-city list with Geographic Intelligence expanded by default, and hard difficulty's
  free map placement with the panel starting collapsed and still fully reachable.
- `e2e/intelligence.live.spec.ts`: covers the same (unmodified) R06/R15 behavior; updated only to
  dismiss the tutorial and click Start before asserting panorama readiness (see below).
- `e2e/singleplayer.live.spec.ts` ("mobile: touch map, preserve pin through collapse and refresh,
  and submit"): **not verified passing**. It fails deterministically (reproduced twice) at a
  synthetic-touch panorama drag check unrelated to any file this task modified — the browser
  console shows real GPU/WebGL stalls in this headless Chromium environment
  (`GPU stall due to ReadPixels`, `CVDisplayLinkCreateWithCGDisplay failed`). This is an
  environment limitation consistent with the project's own existing caveat ("touch verification
  uses Chromium emulation, not a physical phone"), not a regression from this work — no file
  related to touch handling or the Street View viewer was changed. Flagged honestly rather than
  claimed passing; worth re-checking on a machine with real GPU acceleration or a physical device.

**A real bug found and fixed during this verification:** the Tutorial (R14) was originally
offered via a `useEffect` gated on the async config-check resolving. In the real browser this
raced the welcome screen's "Start exploring" button becoming clickable — the tutorial could pop
open as a native modal *after* Playwright (or a fast real user) had already located the button,
intercepting the click and hanging. Fixed by deciding whether to show the tutorial synchronously,
in `useState`'s lazy initializer, before first paint — this is a correctness fix for real users,
not just the test. The e2e specs were also updated to robustly wait for (and dismiss) the tutorial
before proceeding, rather than racing an immediate visibility check.

**R13 (automatic fallback on weather failure) verification strategy:** the failure-injection path
is verified deterministically via unit tests (`singleplayer-location-selection.test.ts`: bounded
retry, exclusion, exhaustion → `WEATHER_UNAVAILABLE`) and integration tests with explicit
`intelligence` doubles (`singleplayer.integration.test.ts`), not by forcing the real Open-Meteo
API to fail on demand — consistent with distinguishing mocked-failure tests from real-provider
verification. Every real round created during the live tests above exercised the real R03 gate
successfully against actual Open-Meteo responses, confirming the gate doesn't false-positive-reject
valid real-world locations.

---

# Verification — 19 November 2026

## Actual Google gameplay verified

`npm run maps:verify` passed **two real-provider Playwright tests** against the running TerraGuessr application. No provider, imagery, map, API, distance, score, or response was mocked in these tests.

The desktop test:

1. Opens Home and clicks Play Solo.
2. Automatically starts a session and waits for a real Google Street View panorama.
3. Verifies camera heading changes after dragging the panorama.
4. Verifies the actual panorama ID changes after navigating along the street.
5. Opens the interactive Google world map and places a marker.
6. Confirms the marker survives map collapse/expansion.
7. Submits a real guess and checks the server score against the documented distance curve.
8. Repeats for all five rounds.
9. Checks five result rows, total score, and total distance.
10. Starts a new game using Play Again and verifies another real panorama.
11. Returns Home through the active-game confirmation dialog.

The mobile test uses a touch-enabled Chromium context at 390×844. It selects a map location by tapping, collapses/reopens the map, refreshes the browser and verifies the selected coordinates survive, then submits the guess and displays actual round results.

The desktop report records all five accepted guesses, exact actual coordinates returned after submission, distances, points, camera movement, street movement, restart, and Return Home. It contains **zero browser console errors or page errors**. No credentials or session tokens are included.

Current real artifacts:

- [Active desktop](../screenshots/playable/active-desktop.png)
- [Active mobile](../screenshots/playable/active-mobile.png)
- [Expanded guessing map](../screenshots/playable/expanded-map.png)
- [Round results](../screenshots/playable/round-results.png)
- [Final results](../screenshots/playable/final-results.png)
- [Mobile round results](../screenshots/playable/mobile-round-results.png)
- [Five-round report](../screenshots/playable/live-game-report.json)

These supersede the old unavailable captures and component fixtures in `screenshots/singleplayer/`.

## Other passing checks

| Check | Result |
| --- | --- |
| Frontend TypeScript + production build | Passed |
| Backend TypeScript | Passed |
| Backend production build | Passed |
| Backend ESLint | Passed, no warnings |
| Frontend oxlint | Passed; five existing warnings in unchanged legacy files, none in new gameplay code |
| Frontend Vitest | **46 passed**, 8 files |
| Backend unit Vitest | **172 passed**, 21 files |
| Singleplayer PostgreSQL integration tests | **9 passed** |
| Missing-key and Auth/navigation/settings Playwright tests | **12 passed** |
| Live Google desktop/mobile Playwright tests | **2 passed** |
| `npm run maps:doctor` | All checks passed, including an actual Google metadata response |
| `git diff --check` | Passed |

The missing-key browser tests run on an independent frontend/backend with the keys explicitly unset via process environment. This does not disable or replace the provider on the configured playable instance. The isolated test frontend uses a separate port and proxies a separate backend against `terraguessr_gameplay_test`.

The database integration tests use real PostgreSQL and explicit provider doubles. They verify ownership, expiration, coordinate validation, five-round persistence, exact scoring, concurrent guess locking, identical retries, and unavailable-provider recovery. New tests verify that replacing failed imagery keeps the same round number, cannot replace scored rounds, never returns the answer early, and cannot race a guess into scoring an old panorama.

Unit tests additionally cover rejected contributor photospheres, distinct provider billing/key/activation/quota failures without credential leakage, stable map instances while guesses lock/unlock, automatic start under React StrictMode, pin restoration, and expired-session recovery.

## Diagnosis and fixes

The initial application had neither Maps key. It stopped before loading Google's SDK and returned only a generic unavailable state. Both local variables are now populated with the supplied credential and the running processes have been restarted.

A second existing Vite process on `localhost:5173` was still targeting an old backend without Street View endpoints. Its working directory was verified as this application before restarting it with the correct proxy. Both localhost and 127.0.0.1 now reach the updated API.

A real Google lookup also exposed a location-selection problem: a contributor photosphere could be chosen instead of connected street imagery. The server now rejects these responses and tries another unused target. The actual panorama's navigation links are checked, and failed imagery can be replaced in the same unscored round. The Google SDK's preliminary service metadata does not always include its eventual navigation links, so the live panorama itself is checked rather than treating an empty preliminary array as proof of no coverage.

## Existing legacy test issues

An earlier broad regression run, before this repair, exposed unrelated old weather-game tests:

- One integration test requests three ASIA candidates but its fixture seeds only one Asian location.
- Two old solo browser tests request map mode on easy / list mode on hard, while the existing difficulty rules force easy to list and hard to map.
- The old weather-fallback browser test similarly waits for a map in easy mode.

Those tests, fixtures, difficulty rules, and weather-game APIs remain unchanged. The current targeted regression run passes all twelve selected missing-key/Auth/navigation/settings cases. No tests have been weakened or deleted: the former small live scenario was moved to `singleplayer.live.spec.ts` and expanded into the stronger desktop and mobile scenarios above.

## Remaining limits

- API key restrictions and account quotas cannot be inspected or edited with a Maps API key alone. The supplied key works for local browser and server requests; deployment should use separate appropriately restricted keys, configured by the Google Cloud project owner.
- Selection uses thirty independently authored road search targets with live availability filtering, not exhaustive global random sampling.
- Sessions/results are tab-local for 24 hours and do not feed the existing weather-game account statistics.
- Actual coordinates for restored results are resolved from Google again, rather than stored as provider content. Restored maps depend on provider availability.
- Touch verification uses Chromium emulation, not a physical phone.
- Street View SDK metadata remains inspectable in browser developer tools; this is singleplayer, not a ranked anti-cheat implementation.
- No reference attachment was available for exact pixel comparison. The existing full-screen design and Home/Auth/Duels layouts were preserved.

See [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) for credentials, exact setup steps, provider error handling, current usage pricing, and quotas.
