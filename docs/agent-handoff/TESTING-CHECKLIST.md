# TESTING-CHECKLIST.md — Required tests per requirement

Status: frozen (Phase 1). Extends `../process/testing-strategy.md` with exact, copy-ready cases.
Tiers per ADR-0012: **U** = unit (runs anywhere, incl. no-egress sandbox), **I** = integration
(Postgres in CI/compose), **E** = e2e (Playwright in CI). Weather is always stubbed in I/E.

## Core logic (tier U — must pass even under full network isolation)

| Req | Test | Assertion / vectors |
|---|---|---|
| R09 | `distance.test.ts` | haversine, `R=6371.0088`. Vectors: `(0,0)→(0,0)=0`; Berlin `(52.52,13.405)`→Paris `(48.8566,2.3522)` ≈ `877 km` (±1). Symmetric. |
| R10 | `scoring.test.ts` | `0→5000`; `100→5000`; `2000→4522`; `10000→2512`; `20000→0`; `20015→0`. R9-rounded boundary (`100.04→5000`, `100.05→<5000`). Monotonically non-increasing over `0..20100`. Never <0, never >5000. Deterministic (same input→same output). |
| R08 | `scoring/distance` | pure: no `Date`/RNG inside; identical repeated calls. |
| R01/R02/R05/R07 | `selection.test.ts` | with a seeded RNG + fixed pool: Easy picks from one region and returns `EASY_CANDIDATES`; Medium returns `MEDIUM_CANDIDATES`; Hard returns none; **actual is always in candidates** (list modes); **no `locationId` repeats** given a used-set; Medium/Hard respect `MIN_SEPARATION_KM` within `MAX_SELECTION_TRIES`. |
| R04 | `roundDto.test.ts` | the round-DTO builder output has **no** `actualLat`/`actualLon`/`actual` key at any nesting depth (deep scan). |
| R13 | `weatherFallback.test.ts` | stubbed client: first location returns incomplete (null humidity) → after 3 retries it is dropped and the next location (complete) is served; never throws; never returns incomplete weather. Backoff timing mocked. |
| R03 | `weatherValidate.test.ts` | all 4 fields present+finite ⇒ valid; any missing/NaN ⇒ invalid; `extra` ignored for validity. |

## API / persistence (tier I — Postgres, stubbed weather)

| Req | Test | Assertion |
|---|---|---|
| R01/R11 | round lifecycle | `POST /games` → `POST rounds` (201, weather present, R04 holds) → `POST guess` returns `{distanceKm,score,actual}` and persists `Guess`+`Result`. |
| R08 state | guess twice | second `POST guess` on same round ⇒ `409 CONFLICT`. |
| state machine | double start | `POST rounds` while a round is active ⇒ `409`; after `ROUNDS_PER_GAME` ⇒ `409`; completed game ⇒ `409`. |
| R04 | wire check | raw JSON of `POST rounds` / `GET rounds/{id}` contains neither actual coord anywhere. |
| ownership | wrong token | owned routes with missing/wrong `X-Player-Token` ⇒ `404`. |
| R16 | challenge isolation | leaderboard contains only entries whose result is for the challenge's fixed round; a result for another round ⇒ `409`. |
| R18 | purge job | insert results at `now-7mo` and `now-1mo`; run purge → old gone, recent kept; `Location` pool untouched. |
| B.14 | admin guard | **every** `/api/admin/*` route without bearer ⇒ `401`; with correct bearer ⇒ 2xx. (Parametrize over the route list so new admin routes are auto-covered.) |
| R12 | prefetch | after `POST rounds`, `Game.nextLocationId`/`nextWeatherSnapshotId` are set; the next `POST rounds` reuses them (assert no new weather fetch call for that location). |
| R13 path | 503 | force every candidate's weather to fail → `POST rounds` ⇒ `503 SERVICE_UNAVAILABLE` (never 500/crash). |

## End-to-end (tier E — Playwright, full stack via compose, stubbed weather)

| Req | Scenario |
|---|---|
| R01/R06/R08/R09/R10/R11/R15 | Play a solo round: weather panel shows the 4 fields in the consistent layout (R15); place a guess on the Leaflet map; submit; see distance + score + revealed actual (R11). |
| R07 | Medium: toggle map vs list; list shows candidates; both submit a guess. |
| R05 | Choose Easy/Medium/Hard from the difficulty UI; Easy is list-only, Hard is map-only. |
| R14 | Tutorial is reachable and explains mechanics, selection, scoring. |
| R16 | Create a challenge, open its share URL, submit, appear on the leaderboard with a display name. |
| R04 | DevTools/network assertion: the round-start response never carries the actual location. |
| contract | conformance: every response matches API-CONTRACTS.md shapes (ADR-0010 drift guard). |

## Definition of "tested enough" per epic
An epic's tests are complete when: all its U cases pass locally **and** in CI, its I/E cases pass
in CI, and the requirement rows above that the epic owns are all green. No epic is "done" on U
tests alone if it has an I/E row (DEFINITION-OF-DONE.md).
