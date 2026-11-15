# Requirements Traceability Matrix — R01–R20

Status: **approved** (Product Owner, Phase 0.5, 2026-11-14). Source: `Software-Engineering_Anforderungsanalyse.pdf`
(table) and `appidee.odt` (exploratory idea document, non-binding). Priority is preserved
verbatim from the source: German *muss* → **MUST**, *sollte* → **SHOULD**.

All 20 requirements are in scope for the complete university release; MUST requirements are
implemented first. MVP scope is documented in `../process/implementation-backlog.md`.

| ID | Requirement (condensed) | Priority | Type | Architecture component(s) | Stack | Status / PO decision |
|----|---|---|---|---|---|---|
| R01 | Random location per round | MUST | Functional | `Location` pool, `Round` service | Postgres + backend | Pool seeded from validated land points (see R08 decision) |
| R02 | Locations on land/islands only | SHOULD | Functional | Pre-baked land mask | Natural Earth polygons + seed job | Resolved: validated land-based pool with reasonable global diversity (decision B.8) |
| R03 | Mandatory base data (temp, precipitation, humidity, wind speed) per location | MUST | Functional | `WeatherSnapshot` | Open-Meteo | Resolved: exactly these 4 fields mandatory; others optional (decision B.2) |
| R04 | Actual location hidden before final submit | MUST | Functional | API response shaping | Backend | No change from Phase 0 |
| R05 | ≥3 difficulty levels | SHOULD | Functional | Difficulty config | Backend + frontend | Resolved: Easy/Medium/Hard, exact rules in `../architecture/architecture.md#difficulty` (decision B.4) |
| R06 | Weather data shown to player | MUST | Functional | Weather endpoint | Open-Meteo | Scope = same 4 fields as R03 (decision B.2 resolves the Phase 0 ambiguity) |
| R07 | Guess via interactive map or list | SHOULD | Functional | Selection UI | Leaflet + OSM-compatible tiles | Resolved: both supported — map primary, list as simplified mode (decision B.5) |
| R08 | Tip modifiable until final submit | MUST | Functional | Client state | Frontend | No change |
| R09 | Distance calculation (great-circle, km) | MUST | Functional | Distance util | Backend | No change |
| R10 | Score from distance | MUST | Functional | Scoring function | Backend | Resolved: `round(5000 * exp(-distanceKm / 2000))`, max 5000/round (decision B.1) |
| R11 | Reveal actual location after submit | MUST | Functional | API response | Backend | No change |
| R12 | Preload next round's data | SHOULD | Non-functional (performance) | Prefetch cron | node-cron + `WeatherSnapshot` cache | Resolved: prefetch exactly 1 round ahead (decision B.12) |
| R13 | Auto-replace location on weather load failure | MUST | Functional | Pool fallback logic | Backend | Resolved: bounded retries, then replace location if required fields unavailable/incomplete (decision B.9) |
| R14 | Tutorial | SHOULD | Functional | Static content | Frontend | No change |
| R15 | Consistent weather data layout | MUST | Non-functional (usability) | Weather UI component | Frontend | No change |
| R16 | Multiplayer, shared location | SHOULD | Functional | Shared challenge + leaderboard | Backend (REST, no WebSockets) | Resolved: asynchronous shared challenges first, same location for all participants, no WebSockets initially (decision B.3) |
| R17 | Own domain, browser-reachable | SHOULD | Non-functional | Deployment | Docker Compose/PaaS + reverse proxy | Resolved: prepare deployment, do not purchase domain or publish without approval (decision B.7) |
| R18 | Store results 6 months | SHOULD | Functional + legal/retention quality attribute | `Result` table + purge cron | Postgres | Resolved: no mandatory registration, minimize personal data, documented 6-month retention policy — see `../security/security-considerations.md` (decision B.6) |
| R19 | Secrets outside source code | MUST | Non-functional (security) | Env vars / secret store | `.env` (gitignored) + platform env vars | No change |
| R20 | Frontend/backend modular separation | SHOULD | Non-functional (maintainability) | Monorepo layout (`frontend/`, `backend/`) | — | No change; architecture = modular monolith, not microservices |

## Explicitly out of scope for the initial release (decision B.10)

Flight data, earthquake data, ranked PvP, and other advanced features from the idea document
(`appidee.odt`) are **not** part of R01–R20 and are not implemented in this release.

## Traceability discipline

Every architecture/stack decision in this repository must trace back either to a row in this
table (a source requirement) or to an explicit Product Owner decision recorded in an ADR under
`../architecture/adr/`. See decision B.15.
