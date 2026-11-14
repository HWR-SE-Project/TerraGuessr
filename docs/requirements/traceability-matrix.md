# Requirements Traceability Matrix — R01–R20

Status: **approved** (Product Owner, Phase 0.5, 2026-11-14). Source: `Software-Engineering_Anforderungsanalyse.pdf`
(table) and `appidee.odt` (exploratory idea document, non-binding). Priority is preserved
verbatim from the source: German *muss* → **MUST**, *sollte* → **SHOULD**.

All 20 requirements are in scope for the complete university release; MUST requirements are
implemented first. MVP scope is documented in `../process/implementation-backlog.md`.

Each requirement below maps to a passing test reference (actual test file and, where applicable,
the row / describe / it that exercises it). Test paths are relative to the repository root.

| ID | Requirement (condensed) | Priority | Test reference (file / row) | Status |
|----|---|---|---|---|
| R01 | Random location per round | MUST | `backend/test/unit/land-pool.test.ts`, `backend/test/domain/selection.test.ts`, `backend/test/integration/game-lifecycle.integration.test.ts` | ✅ Pass |
| R02 | Locations on land/islands only | SHOULD | `backend/test/unit/land-pool.test.ts` (point-in-polygon), `backend/test/unit/locations-service.test.ts` | ✅ Pass |
| R03 | Mandatory base data (temp, precipitation, humidity, wind speed) per location | MUST | `backend/test/unit/weather.test.ts` (validate) | ✅ Pass |
| R04 | Actual location hidden before final submit | MUST | `backend/test/unit/rounds.test.ts` (R04 deep scan), `backend/test/integration/game-lifecycle.integration.test.ts` (raw round-start/re-fetch JSON), `backend/test/integration/contract-conformance.integration.test.ts` (R04 holds), `e2e/r04-network.spec.ts` | ✅ Pass |
| R05 | ≥3 difficulty levels | SHOULD | `backend/test/domain/selection.test.ts`, `e2e/difficulty-modes.spec.ts`, `frontend/src/features/difficulty/DifficultyPicker.test.tsx` | ✅ Pass |
| R06 | Weather data shown to player | MUST | `backend/test/unit/weather.test.ts`, `e2e/solo-round.spec.ts` | ✅ Pass |
| R07 | Guess via interactive map or list | SHOULD | `backend/test/domain/selection.test.ts`, `frontend/src/features/map/MapPicker.test.tsx`, `frontend/src/features/list/CandidateList.test.tsx`, `e2e/medium-mode-toggle.spec.ts` | ✅ Pass |
| R08 | Tip modifiable until final submit | MUST | `backend/test/unit/results.test.ts` (409), `frontend/src/features/game/RoundScreen.test.tsx` | ✅ Pass |
| R09 | Distance calculation (great-circle, km) | MUST | `backend/test/domain/distance.test.ts` | ✅ Pass |
| R10 | Score from distance | MUST | `backend/test/domain/scoring.test.ts` | ✅ Pass |
| R11 | Reveal actual location after submit | MUST | `backend/test/unit/results.test.ts`, `frontend/src/features/game/RoundScreen.test.tsx` | ✅ Pass |
| R12 | Preload next round's data | SHOULD | `backend/test/unit/prefetch.test.ts` — **event-driven per architecture §6a** (per-game `Game.next*` fields), **not cron**; retention purge is the only cron job (§7a) | ✅ Pass |
| R13 | Auto-replace location on weather load failure | MUST | `backend/test/unit/weather.test.ts`, `backend/test/integration/weather-fallback.integration.test.ts` (503) | ✅ Pass |
| R14 | Tutorial | SHOULD | `frontend/src/features/tutorial/Tutorial.test.tsx`, `e2e/tutorial.spec.ts` | ✅ Pass |
| R15 | Consistent weather data layout | MUST | `frontend/src/features/game/RoundScreen.test.tsx` (WeatherPanel) | ✅ Pass |
| R16 | Multiplayer, shared location | SHOULD | `backend/test/unit/challenges.test.ts`, `frontend/src/features/challenge/ChallengePanel.test.tsx` (no dedicated e2e challenge spec present) | ✅ Pass |
| R17 | Own domain, browser-reachable | SHOULD | `docs/deploy.md` (prepared, **not executed** — decision B.7) | ✅ Prepared (no automated test) |
| R18 | Store results 6 months | SHOULD | `backend/test/unit/purge.test.ts` | ✅ Pass |
| R19 | Secrets outside source code | MUST | Structural: `.env` gitignored, all config from environment (`.env.example` authoritative) — no test; see `docs/architecture/architecture.md` §10 | ✅ Verified structurally |
| R20 | Frontend/backend modular separation | SHOULD | Structural: monorepo layout `frontend/` + `backend/` — no test | ✅ Verified structurally |

## Verification summary (M5 closeout, host-verified)

- **Backend unit tests:** 107 passing ✅
- **Backend integration tests:** 16 passing ✅
- **Frontend tests:** 34 passing ✅
- **E2E suite:** present — Playwright specs under `e2e/` (`difficulty-modes`, `medium-mode-toggle`, `r04-network`, `solo-round`, `tutorial`), runs in CI.

All automated suites are green on the host. R17, R19, and R20 are covered structurally (documentation
and repository layout) rather than by an executable test, as reflected in their rows.

## Explicitly out of scope for the initial release (decision B.10)

Flight data, earthquake data, ranked PvP, and other advanced features from the idea document
(`appidee.odt`) are **not** part of R01–R20 and are not implemented in this release.

## Traceability discipline

Every architecture/stack decision in this repository must trace back either to a row in this
table (a source requirement) or to an explicit Product Owner decision recorded in an ADR under
`../architecture/adr/`. See decision B.15.
