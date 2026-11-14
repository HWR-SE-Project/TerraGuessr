# TerraGuessr — Architecture Specification

Status: **approved**, Phase 0.5 (2026-11-14). Supersedes the Phase 0 draft recommendation with
Product Owner decisions (section B of the Phase 0.5 brief). Traceability: see
`../requirements/traceability-matrix.md`.

## 1. Shape

Modular monolith. One backend service (REST API), one frontend SPA, one PostgreSQL database,
an in-process scheduler for prefetch/retention. No microservices, no Kubernetes, no GraphQL.

```
Browser (React + TypeScript + Vite SPA, Leaflet map)
        │  HTTPS / JSON (REST)
        ▼
Backend (Node.js + TypeScript + Fastify, single deployable)
  ├─ REST API (game/round/guess/challenge/result endpoints)
  ├─ Distance + scoring (R09/R10)
  ├─ In-process scheduler: prefetch (R12) + retention purge (R18)
  └─ Secrets from environment variables (R19)
        │
        ▼
PostgreSQL (via Prisma)
  ├─ candidate locations (validated land pool, R02)
  ├─ weather snapshots cache, ≤1h TTL (R03/R06/R12)
  ├─ games / rounds / guesses / results (R01/R11/R18)
  └─ async challenges / leaderboard entries (R16)
```

`frontend/` and `backend/` are separate top-level modules in one repository/monorepo (R20);
"modular" means separation of concerns, not separate deployables or services.

## 2. Approved technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React, TypeScript, Vite | |
| Backend | Node.js, TypeScript, Fastify | |
| Database | PostgreSQL | |
| ORM | Prisma | |
| Map | Leaflet | Tile provider selected per actual usage policy — see §3 and ADR-0007 |
| Weather | Open-Meteo | Gridded, keyless for non-commercial use, CC-BY 4.0 — see ADR-0003 |
| API style | REST | ADR-0002 |
| Testing | Vitest (unit/integration), Playwright (e2e) | |
| CI/CD | GitHub Actions | |

Explicitly avoided: microservices, Kubernetes, GraphQL, message queues, separate worker
processes, unnecessary infrastructure.

## 3. Map tiles (decision B.13)

OpenStreetMap's own tile service (`tile.openstreetmap.org`) has a restrictive usage policy
(heavy/bulk/production use is not permitted without prior arrangement). This does **not** mean
OSM-derived tiles are unusable — it means the raw `openstreetmap.org` endpoint specifically is
unsuitable for a deployed app. Approach: use an OSM-compatible tile provider with a usage policy
that actually permits our traffic pattern (e.g. a provider with a free/low-volume tier intended
for production use), and re-check that provider's current terms before R17 deployment. This is
a deployment-time decision, not a code-time one — Leaflet is provider-agnostic.

## 4. Difficulty levels (decision B.4 — exact rules)

Three levels, differentiated by geographic scope and selection mode, using the mechanisms
already in the data model (no separate "difficulty engine" needed):

| Level | Geographic scope | Selection mode | Candidate count (list mode) |
|---|---|---|---|
| **Easy** | Single curated region/continent per round (high climate/visual distinctiveness) | List only | 4–6 candidates |
| **Medium** | Whole world | List or interactive map (player's choice) | 6–10 candidates (list mode) |
| **Hard** | Whole world | Interactive map only (no list) | — |

The scoring formula (R10) is identical across all three levels — difficulty changes what the
player has to work with, not how points are computed. This keeps `Result` comparable across
difficulties for the leaderboard (R16).

## 5. Multiplayer (decision B.3)

Asynchronous shared challenges only in this release: a `Challenge` fixes one `Round` (one
location) that multiple players attempt independently and whose results are compared on a
leaderboard. No WebSocket/real-time transport, no live presence. The REST API is designed so a
synchronous mode could be added later as an additive endpoint set, not a rewrite (see
`api-contract.md`).

## 6. Weather data freshness & failure handling (decisions B.9, B.11, B.12)

- `WeatherSnapshot` rows are cached for **up to 1 hour**, each with an explicit `fetchedAt`
  timestamp. Snapshots older than 1 hour are treated as stale and refetched.
- The scheduler prefetches weather for **exactly 1 round ahead** of the current one.
- On fetch failure: **bounded retries** (fixed small retry count with backoff) against
  Open-Meteo; if required fields (temperature, precipitation, humidity, wind speed — R03) are
  still unavailable or incomplete after retries, the location is dropped from the candidate pool
  for this selection and another is chosen (R13). A location is never served to a player with
  incomplete mandatory weather data.

## 7. Privacy & retention (decision B.6)

No mandatory user registration. Anonymous play is the default path. Where a result needs to be
retrievable by a player (history), it's addressed by a client-held opaque token, not an account.
Full policy and data classification: `../security/security-considerations.md`.

## 8. Admin endpoints (decision B.14)

Any administrative/operational endpoint (location pool refresh, manual prefetch trigger) must
require authentication. No unauthenticated admin endpoint ships, including during MVP.
