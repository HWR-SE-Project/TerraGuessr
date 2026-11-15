# Implementation Backlog (draft, Phase 0.5)

Dependency-ordered epics. Owner column is the proposed primary agent (see `agent-ownership.md`);
nothing here is being executed yet — Phase 1 start requires separate Product Owner approval.

| Epic | Scope | Primary owner | Depends on | MVP? |
|---|---|---|---|---|
| 0 — Foundations | Monorepo scaffold (`frontend/`, `backend/`), Postgres up, `.env`/secrets pattern, Prisma init | backend | — | Yes |
| 1 — Location pool & weather | Seed validated land pool (Natural Earth), integrate Open-Meteo, `WeatherSnapshot` storage + mandatory-field validation | data-engineer | Epic 0 | Yes |
| 2 — Core solo game loop | Random location, weather-only reveal, mutable guess, haversine distance, scoring (ADR-0006), reveal, bounded-retry fallback, consistent weather layout | backend + frontend | Epic 1 | Yes |
| 3 — Selection UI | Leaflet map (R07 map mode); list-mode selection component | frontend | Epic 2 | Yes (map); list mode fast-follow |
| 4 — Difficulty levels | Easy/Medium/Hard per `architecture.md` §4 | frontend + backend | Epic 3 | Fast-follow |
| 5 — Prefetch | 1-round-ahead cache job (decision B.12) | data-engineer + backend | Epic 1 | Fast-follow |
| 6 — Tutorial | Static tutorial content | frontend | Epic 2 | Fast-follow |
| 7 — Persistence & retention | `Result` storage + 6-month purge cron, privacy policy implementation | backend | Epic 2 | Store from day 1; purge job by release |
| 8 — Async challenges | Shared round, leaderboard, no WebSockets (ADR-0005) | backend + frontend | Epic 2 | Later |
| 9 — Deployment prep | Containerize, CI, domain/TLS readiness — **do not purchase domain or publish without approval** (decision B.7) | devops | Epic 0 | Later |

## MVP definition (carried from Phase 0, confirmed unchanged by Phase 0.5 decisions)

MUST + Basismerkmal core loop (R01, R03, R04, R06, R08, R09, R10, R11, R13, R15), plus R02
(bundled with R03's seed job) and R07 map mode. See `../requirements/traceability-matrix.md` for
full per-requirement status.
