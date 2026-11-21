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
require authentication. No unauthenticated admin endpoint ships, including during MVP. Mechanism:
static bearer token, ADR-0011.

---

## Phase 1 finalization (Principal Architect, 2026-11-14)

The following resolve ordinary engineering decisions so implementing agents need not ask. Each
traces to an ADR. They refine — never contradict — §1–§8 above.

### 6a. Prefetch mechanism (R12, resolves the "1 round ahead" tension)

"Preload exactly 1 round ahead" (decision B.12) is implemented **per game**, not globally. On
`POST /games/{id}/rounds` the server, after returning the current round, asynchronously:
1. selects the actual location for round *n+1* (ADR-0008 rules, excluding used + current),
2. ensures a fresh `WeatherSnapshot` (≤1h) exists for it, fetching if needed,
3. stores `Game.nextLocationId` + `Game.nextWeatherSnapshotId`.

The **next** `POST .../rounds` consumes that pending selection if still fresh (fast path), else
selects normally. This is a pure latency optimization: correctness never depends on the prefetch
having run. The admin `POST /admin/weather/prefetch` warms snapshots across the pool and is
unrelated to per-game prefetch. No standalone prefetch cron is needed; retention purge is the only
scheduled job (§7a).

### 9. Game & round state machine (R01/R08/R11)

```
Game:  active ──(final round completed)──▶ completed
Round: active ──(POST /rounds/{id}/guess)──▶ completed   // writes Guess + Result atomically
```
Invariants (enforced server-side, tested):
- At most **one** `active` round per game at any time.
- `POST /games/{id}/rounds` is rejected `409 CONFLICT` if an active round exists, or if the game
  is `completed`, or (solo) if `ROUNDS_PER_GAME` rounds already exist.
- `POST /rounds/{id}/guess` on a non-`active` round ⇒ `409 CONFLICT` (enforces R08's "one final
  submit"; mutation before submit is client-only state).
- Completing the final solo round (`roundNumber === ROUNDS_PER_GAME`) flips the game to
  `completed`. A challenge game completes when its single round completes.

### 7a. Scheduler (R18)

In-process `node-cron`. **Retention purge** runs daily at `03:00 UTC`: deletes `Result` rows with
`createdAt < now − 6 months` (and their `Round`/`Guess` history), never touching `Location` pool
rows (see data-model note). This is the only cron job. Prefetch (§6a) is event-driven, not cron.

### 10. Configuration surface (R19)

All config via environment (never committed). `.env.example` is the authoritative list.
- **Backend:** `DATABASE_URL`, `PORT` (default 3000), `CORS_ORIGIN`, `ADMIN_API_TOKEN`,
  `OPEN_METEO_BASE_URL` (default `https://api.open-meteo.com`), `LOG_LEVEL`.
- **Frontend (build-time, Vite):** `VITE_API_BASE_URL`, `VITE_TILE_URL` (OSM-compatible XYZ
  endpoint — dev default documented, finalized at deploy per ADR-0007), `VITE_MAP_ATTRIBUTION`
  (must credit Open-Meteo + tile provider — ADR-0003/§1.4).

### 11. Weather provider call (R03/R06/R13) — exact

`GET {OPEN_METEO_BASE_URL}/v1/forecast?latitude={lat}&longitude={lon}`
`&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,surface_pressure,wind_direction_10m,uv_index`
`&daily=sunshine_duration&timezone=auto&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm`

Field mapping: `current.temperature_2m→temperatureC`, `current.relative_humidity_2m→humidityPct`,
`current.precipitation→precipitationMm`, `current.wind_speed_10m→windSpeedKmh`,
`current.surface_pressure→airPressureHpa`, `current.wind_direction_10m→windDirectionDeg`,
`current.uv_index→uvIndex`, `daily.sunshine_duration[0]→sunshineDurationSeconds`, and
`current.time→localTime` (`timezone=auto`).
**Mandatory validation:** the four base fields must be present and finite numbers. Pressure and
the additional solar/local-time fields are optional nullable values and do not block a round. On mandatory-field failure: retry `3×` with backoff
`250/500/1000 ms`; if still incomplete, drop the location and select another (R13). A location is
never served with an incomplete mandatory set. The weather client is an **injectable interface**
(`WeatherClient`) so tests stub it (ADR-0012).

### 12. Scoring & distance — exact constants (R09/R10, ADR-0006)

- Distance: haversine, Earth radius `R = 6371.0088 km`. Pure fn `domain/distance.ts`.
- Score: linear decay applied to the R9-rounded (one-decimal) distance — `5000` up to `100 km`,
  `0` at `≥20000 km`, `floor(5000 × (20000 − km) / 19900)` in between. Pure fn
  `domain/scoring.ts`. Test vectors (TESTING-CHECKLIST): `0→5000`, `100→5000`, `2000→4522`,
  `10000→2512`, `≥20000→0`.
