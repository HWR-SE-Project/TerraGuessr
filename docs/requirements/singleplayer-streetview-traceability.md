# Requirements Traceability Matrix — Street View Singleplayer (R01–R15, R18–R20)

Status: implemented and verified, 2026-11-20. Source: `Software-Engineering_Anforderungsanalyse.pdf`.

## Scope note (read this first)

The existing [`traceability-matrix.md`](./traceability-matrix.md) in this directory (approved
2026-11-14) documents a **different system**: the original "weather game" at `/play`
(`backend/src/modules/games|rounds|results|locations|weather|challenges`, Prisma models
`Game`/`Round`/`Result`/`Location`/`WeatherSnapshot`), built against a frontend structure
(`frontend/src/features/*`) that no longer exists after the 2026-11-20 frontend rebuild
(`6d3eb22`, "First MVP: single player, basic design").

The Singleplayer experience actually reachable from the app today —
`Home → "Play Solo"` → `/game/singleplayer` — is a separate system: real Google Street View
and Google Maps JS, backed by `backend/src/modules/singleplayer/*` and the `StreetGame`/
`StreetRound`/`StreetResult` Prisma models. The legacy `/play` weather game and its API
modules have since been removed. This document traces R01–R15 and the applicable cross-cutting requirements
(R18–R20) **against the Street View system**, which is what section 22 of the implementation
task ("preserve... Google Street View interface... Guessing map") and the task's own
description of existing functionality both point to. R16 (multiplayer) and R17 (custom domain)
are out of scope per the task.

Where a requirement was already correctly implemented before this work, that is stated
explicitly — this matrix does not claim new work for things that were already right.

| ID | Requirement (condensed) | Priority | Implementation | Test evidence | Status |
|----|---|---|---|---|---|
| R01 | Random location per round | MUST | `provider()` (`backend/src/modules/singleplayer/provider.ts`) draws from 30 curated road targets, excluding `targetIndex` values already used in the game | `backend/test/unit/singleplayer-provider.test.ts`; `backend/test/integration/singleplayer.integration.test.ts` ("plays five rounds...") | PASS |
| R02 | Land/island only | SHOULD | All 30 `ROAD_TARGETS` are real city roads (land by construction) | New: `backend/test/unit/singleplayer-land.test.ts` — point-in-polygon regression against the same Natural Earth 110m land-mask data the weather-game pool uses, for all 30 targets | PASS |
| R03 | Mandatory base data (temp, precipitation, humidity, wind speed) per location | MUST | New: `selectValidatedTarget()` (`backend/src/modules/singleplayer/locationSelection.ts`) gates round acceptance on `isValidStreetWeather()` — all four fields present and finite — before a round is created or a retry is served | New: `backend/test/unit/singleplayer-location-selection.test.ts`; `backend/test/integration/singleplayer.integration.test.ts` ("automatic location replacement on weather failure") | PASS |
| R04 | Actual location hidden before final submit | MUST | `PublicRound` only ever exposes `id`/`number`/`panoId`(/`candidates`, which never flags the correct one); actual coordinates resolved server-side only at guess time | `backend/test/integration/singleplayer.integration.test.ts` (`Object.keys(round)` assertions); documented SDK-inspectability caveat in `docs/gameplay/SINGLEPLAYER.md` (pre-existing, accurate) | PASS |
| R05 | ≥3 difficulty levels | SHOULD | Shared `domain/gameRules.ts` now drives both modes: Easy 7 min / 3 attempts / list / free extra data; Medium 4 min / 2 attempts / map with borders / −100 points to unlock; Hard 2 min / 1 attempt / map with borders / −20 seconds to unlock. Singleplayer stores the timer, attempts, latest selection and unlock state on `StreetRound`; extra-data access is server-authoritative | `backend/test/unit/round-flow.test.ts`; `backend/test/unit/lobbies.test.ts`; `frontend/src/pages/singleplayer/DifficultyPicker.test.tsx`; `frontend/src/pages/singleplayer/useGameSession.test.tsx` | PASS |
| R06 | Weather data shown to player | MUST | `GeographicIntelligence.tsx` (pre-existing, unchanged): all 4 mandatory fields clearly shown, separated from optional extras | `backend/test/unit/intelligence.test.ts`; `frontend/src/pages/singleplayer/GeographicIntelligence.test.tsx`; `e2e/intelligence.live.spec.ts` (real Open-Meteo) | PASS |
| R07 | Guess via interactive map or list | SHOULD | New: easy-difficulty rounds carry a `candidates` list (actual target + 5 shuffled distractors, real city labels) built by `backend/src/modules/singleplayer/candidates.ts`; frontend renders the existing, reused `frontend/src/components/CandidateList.tsx` instead of the map, submitting through the identical `/guess` endpoint | New: `backend/test/unit/singleplayer-candidates.test.ts`; `frontend/src/components/CandidateList.test.tsx`; `backend/test/integration/singleplayer.integration.test.ts` | PASS |
| R08 | Tip modifiable until final submit | MUST | `GuessMap.tsx` (pre-existing, unchanged): draggable/re-clickable marker until `submit()` locks it; same guarantee now applies to list selection (clicking a different candidate just updates `guess` again) | `frontend/src/pages/singleplayer/maps.test.tsx`; `e2e/singleplayer.spec.ts` | PASS |
| R09 | Distance calculation (great-circle, km) | MUST | Shared `backend/src/domain/distance.ts` (`haversineKm`, mean Earth radius 6371.0088 km), used identically by the Street View guess endpoint | `backend/test/domain/distance.test.ts`; `backend/test/integration/singleplayer.integration.test.ts` (exact-value assertions) | PASS |
| R10 | Distance-based scoring | MUST | Shared `backend/src/domain/scoring.ts` (R10 boundaries: `5000` up to 100 km and `0` from 20,000 km, linear decay in between, computed on the R9-rounded distance; 5,000/round, no total cap); atomic conditional update, no client-supplied score accepted | `backend/test/domain/scoring.test.ts`; `backend/test/integration/singleplayer.integration.test.ts` ("rejects... client-submitted scores") | PASS |
| R11 | Reveal actual location after submit | MUST | `RoundResults`/`FinalResults` (`GameResults.tsx`, pre-existing, unchanged): both markers, geodesic line, distance, score, Next Round action | `e2e/singleplayer.live.spec.ts` (real-provider five-round game + screenshots) | PASS |
| R12 | Preload next round's data | SHOULD | New: `prefetchNextStreetRound()` (`backend/src/modules/singleplayer/prefetch.ts`), fire-and-forget after a guess locks, best-effort weather-validated selection cached on `StreetGame.next*`; `POST .../rounds` consumes it atomically (guarded update, no double-consumption race) and clears it, falling back to the synchronous path if absent/stale | New: `backend/test/integration/singleplayer.integration.test.ts` ("next-round prefetch" — fast-path consumption without an extra provider call, background population, no prefetch once complete) | PASS |
| R13 | Automatic replacement on weather load failure | MUST | Same gate as R03: `selectValidatedTarget()` excludes a weather-invalid target and retries with another, bounded by an explicit attempt ceiling and the finite target pool (never infinite); exhaustion returns a recoverable `WEATHER_UNAVAILABLE` 503 | New: `backend/test/unit/singleplayer-location-selection.test.ts` (bounded retry + exhaustion); `backend/test/integration/singleplayer.integration.test.ts` ("skips a location whose weather cannot be loaded...", "never starts a round... when weather is unavailable everywhere") | PASS |
| R14 | Tutorial | SHOULD | New: `frontend/src/pages/singleplayer/Tutorial.tsx`, 5 steps (weather, location, confirmation, distance, scoring) with an in-card practice location list and try-out guess submission, an interactive score slider using the server formula, plus Exit and Restart at every step; auto-opens for every new game and is replayable from the home entry and in-game menu | New: `frontend/src/pages/singleplayer/Tutorial.test.tsx`; `e2e/tutorial.spec.ts` | PASS |
| R15 | Consistent weather data layout | MUST | `GeographicIntelligence.tsx` renders the full weather section identically in every round (desktop panel and mobile sheet share one body), with the same Temperature / Wind speed / Humidity / Precipitation labels, units and order; the compact mobile summary reuses those labels, units and order | `frontend/src/pages/singleplayer/GeographicIntelligence.test.tsx` (labels, units, order, mobile summary); `e2e/intelligence.live.spec.ts` (desktop + mobile) | PASS |
| R18 | Store results 6 months | SHOULD | New: `StreetResult` model (actual + guess coordinates, score, difficulty, timestamp), written once per locked guess, with **no relation** to `StreetGame`/`StreetRound` so the 24h session-expiry cleanup never touches it; `purgeExpiredStreetResults()` (`backend/src/scheduler/purge.ts`) runs daily alongside the existing weather-game purge, same 6-month `PURGE_RETENTION_MS` cutoff | New: `backend/test/unit/street-purge.test.ts`; `backend/test/integration/singleplayer.integration.test.ts` ("durable result archive") | PASS |
| R19 | Secrets outside source code | MUST | Pre-existing, unchanged: `GOOGLE_MAPS_SERVER_API_KEY` server-only; `VITE_GOOGLE_MAPS_API_KEY` documented as a restricted public browser key; `.env`/`.env.local` gitignored; `.env.example` authoritative and secret-free | Structural: `docs/gameplay/GOOGLE_MAPS_SETUP.md`, root `.env.example`, `frontend/.env.example`; no test | PASS (structural) |
| R20 | Frontend/backend modular separation | SHOULD | Pre-existing, unchanged: monorepo `frontend/`+`backend/`, typed contracts (TypeBox schemas), no DB access from frontend, weather/location-selection logic encapsulated in dedicated backend modules | Structural: repository layout; no test | PASS (structural) |

## What changed vs. what didn't

**New for this task:** R03 gate + R13 fallback (previously weather was fetched only after a
round started, never validated before acceptance), R05 difficulty levels, R07 list mode, R12
prefetch, R14 tutorial, R18 durable archive + retention. Schema changes are additive only
(`backend/prisma/migrations/20261120172041_street_singleplayer_requirements`).

**Already correct, left alone:** R01, R02 (by construction), R04, R06, R08, R09, R10, R11, R15,
R19, R20 — these needed verification/evidence, not new implementation. `domain/distance.ts` and
`domain/scoring.ts` were shared with the legacy `/play` weather-game, so neither R09 nor R10
risked silent divergence between the two systems before it was removed.

## Known limitations (unchanged from before this task, carried over honestly)

- 30 curated road search targets, not unrestricted global sampling (documented tradeoff for
  guaranteed Street View coverage).
- 24h tab-local session resume; this is a UX/security choice about *resumable sessions*, not
  about result retention — R18 is satisfied independently via the `StreetResult` archive.
- No ranked anti-cheat: an interactive browser SDK inherently exposes panorama metadata to a
  determined user with developer tools (documented since the original implementation).
- The easy-mode candidate list draws distractors from the same 30-target pool; across many
  games an attentive player could eventually recognize the full set. This is an inherent
  consequence of the curated-pool design (already a known, documented constraint), not something
  newly introduced.
