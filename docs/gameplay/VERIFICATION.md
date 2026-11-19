# Verification — 19 November 2026

## Passing checks

| Check | Result |
| --- | --- |
| Frontend TypeScript + production build (`npm run build --prefix frontend`) | Passed; gameplay has its own lazy-loaded JS/CSS chunks |
| Backend TypeScript (`npm run typecheck --prefix backend`) | Passed |
| Backend production build (`npm run build --prefix backend`) | Passed |
| Backend ESLint (`npm run lint --prefix backend`) | Passed, no warnings |
| Frontend oxlint (`npm run lint --prefix frontend`) | Passed; five warnings remain in unchanged legacy components; none in new gameplay code |
| Frontend Vitest (`npm test --prefix frontend`) | **40 passed**, 8 files |
| Backend unit Vitest (`npm test --prefix backend`) | **167 passed**, 21 files |
| New PostgreSQL integration tests (`npx vitest run test/integration/singleplayer.integration.test.ts --no-file-parallelism` in backend) | **7 passed** |
| New gameplay Playwright suite (`npx playwright test e2e/singleplayer.spec.ts`) | **3 passed**, **1 skipped** pending real Maps credentials |
| Registration-throttled regression tests, rerun separately | **3 passed**: Play Together, shared navigation, settings display name |
| Prisma client generation + additive migration | Passed on the local database and isolated test database |
| Screenshot capture script | Passed; zero browser page errors |
| `git diff --check` | Passed |

The integration database is a separate `terraguessr_gameplay_test` database. PostgreSQL, real Fastify routing, response serialization, schema validation, and conditional updates are exercised. Provider metadata is replaced by **explicit test doubles** in integration tests. Frontend SDK doubles exercise event handling, failure states, and cleanup without images; these do not verify real Google rendering.

New automated coverage includes:

- Missing browser/server keys; no invented round or score when unavailable.
- Live-provider adapter request construction, outdoor coverage validation, unavailable coverage retries, denied access, malformed JSON, network failure, and exact panorama lookup.
- Five-round lifecycle; persisted totals; no answer coordinates in active round responses; ownership and expiration.
- Rejection of out-of-range, null, nonnumeric, and string coordinates; client-supplied scores cannot affect results.
- Atomic concurrent guess locking, identical submission retries, different subsequent guesses, completed-game transitions, and retry after provider failure.
- No score/lock if exact panorama position cannot be verified.
- Panorama loading gates guessing; duplicate click/submission prevention; lost-response reconciliation; resume; restart; five-round completion.
- Map click and pin drag events; result markers and geodesic line; read-only results; failed map loading; panorama status errors; scroll-zoom settings and cleanup.
- Browser map expansion/collapse, persistent settings, Escape, focus restoration, menu resume, Return navigation, viewport bounds, and non-overlapping compact Return/HUD/map controls.

## Broader regression results and existing failures

The complete backend integration run returned **38 passed, 1 failed** before the final seventh singleplayer integration case was added. The failure is the unchanged test `enforces continent scope and configured multiple-choice count on the server` in `backend/test/integration/game-lifecycle.integration.test.ts`: it requests three ASIA candidates, but `helpers/database.ts` seeds only one Asian location. The returned candidate count is one. Neither the old selection code nor that test/fixture was changed.

A complete Playwright run against a separate test backend, seeded database, and the repository's existing deterministic weather server returned **24 passed, 6 failed, 1 skipped**. Three failures were registration throttling (`Too many attempts. Try again in a minute.`). All three passed in a separate rerun without changing rate limits or tests.

The other three failures are unchanged legacy weather expectations:

- `e2e/solo-round.spec.ts`, easy map game: expects a map, while the existing `resolveSelectionMode()` always selects a list on easy.
- `e2e/solo-round.spec.ts`, hard list game: expects candidate buttons, while the existing function always selects a map on hard.
- `e2e/weather-fallback.spec.ts`: also requests an easy map game and waits for a map after the backend correctly returns a list.

These tests and the old selection rules remain unchanged. The existing Home test's complete three-round **medium** weather expedition passed, as did challenge sharing, authenticated identity, daily challenges, Auth, Duels layout, and account settings. Navigation assertions were updated only for the intentionally changed Solo route; the legacy weather flow's assertions remain intact.

No tests were removed, skipped to suppress failures, or weakened. The single new opt-in live-provider test is skipped until explicitly enabled with credentials.

## Browser captures

`docs/screenshots/singleplayer/browser-results.json` records zero page errors and geometry at:

- 1792×861 desktop; 1280×800 laptop.
- 1024×768 and 768×1024 tablet.
- 390×844 phone; 320×640 small phone.
- 844×390 landscape.

All have `scrollWidth === viewport width`. Small-screen clipping/overlap found during implementation was corrected. Mobile Return has an explicit accessible name, and native dialogs explicitly restore trigger focus. Screenshot capture waits for map expansion transitions to settle.

The first five screenshots show the **real unavailable state** with no Maps keys. The two result screenshots are watermarked **UI FIXTURE** and use isolated component examples, with the actual provider-unavailable map state. They must not be presented as completed live expeditions.

## Not verified / remaining limitations

- No Maps keys were present in inspected configuration. Google API authorization, billing, actual imagery rendering, camera navigation along streets, live map tiles, and genuine completed-game screenshots await credentials. No successful live provider call is claimed.
- No reference screenshot attachment was available, so pixel matching and the reference's exact viewport size cannot be verified. Corner layout follows the written brief.
- Mobile checks use Chromium viewport/touch-compatible UI; physical-device gesture behavior remains unverified.
- The source pool contains 30 authored road targets with live coverage filtering. It is not exhaustive worldwide random sampling.
- Results can resume in the same tab for 24 hours. They are separate from legacy account weather-game statistics. Restored actual coordinates require live panorama metadata; expired/unavailable panoramas show an error rather than an invented answer.
- Browser SDK metadata remains inspectable with developer tools. This singleplayer integration does not claim competitive anti-cheat protection.

Configuration, provider documentation, local commands, screenshot links, and the opt-in live test are in [SINGLEPLAYER.md](SINGLEPLAYER.md).
