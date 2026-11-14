# TASK-BACKLOG.md — Executable tasks

Status: frozen (Phase 1). Each task is independently executable with only: its card, the named
contracts, and its owned files. IDs: `F`=foundations, `D`=data, `B`=backend, `W`=web/frontend,
`Q`=qa, `O`=devops. `∥` marks tasks that run in parallel. Owner codes per MODULE-OWNERSHIP.md.
Acceptance = "AC"; tests reference TESTING-CHECKLIST.md rows.

Legend for each card: **Owner · Reqs · Deps · Files · AC · Tests · DoD**.

---

## Milestone M0 — Foundations (unblocks everything)

### F-01 · Backend scaffold  ∥
- Owner: backend · Reqs: R20 · Deps: — · Files: `backend/{package.json,tsconfig.json,.eslintrc,src/server.ts,src/app.ts,src/config/env.ts,src/config/constants.ts,src/db/prisma.ts}`
- Deliverable: Fastify app factory + typed env loader + constants (`ROUNDS_PER_GAME=5`,
  `EASY_CANDIDATES=5`, `MEDIUM_CANDIDATES=8`, `MIN_SEPARATION_KM=500`, `MAX_SELECTION_TRIES=10`,
  `WEATHER_TTL_MS=3600000`, `EARTH_RADIUS_KM=6371.0088`), `GET /api/health`.
- AC: `npm run build` + `npm run lint` pass; `GET /api/health`→`{status:'ok',time}`. Tests: health U.

### F-02 · Frontend scaffold  ∥
- Owner: frontend · Reqs: R20 · Deps: — · Files: `frontend/{package.json,tsconfig.json,vite.config.ts,index.html,.eslintrc,src/main.tsx,src/App.tsx,src/api/client.ts,src/api/types.ts,src/state/gameStore.tsx}`
- Deliverable: Vite+React+TS app shell; `api/client.ts` wraps fetch with `X-Player-Token` + error
  envelope parsing; `api/types.ts` mirrors API-CONTRACTS.md; empty routed shell.
- AC: `npm run build`+`lint` pass; app renders a placeholder home. Tests: a trivial RTL render test.

### D-01 · Prisma schema + migration  (schema gate)
- Owner: data-engineer · Reqs: R18,R20 · Deps: — · Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`
- Deliverable: transcribe **verbatim** the schema in `data-model.md`; `prisma migrate dev`
  produces the initial migration; `prisma generate`.
- AC: migration applies on empty Postgres; generated client compiles. **This must land before any
  task that imports `@prisma/client`.** Tests: migration apply in CI.

### O-01 · CI + compose + env  ∥
- Owner: devops · Reqs: R17,R19 · Deps: — · Files: root `package.json`, `playwright.config.ts`,
  `docker-compose.yml`, `docker-compose.test.yml`, `.env.example`, update `.github/workflows/ci.yml`
  (add Postgres `services:` to backend job + an e2e stack step), `backend/Dockerfile`, `frontend/Dockerfile`, nginx conf.
- Deliverable: compose brings up postgres+backend+frontend; `.env.example` lists every var from
  architecture.md §10; CI runs lint+Vitest with a Postgres service and Playwright against compose.
- AC: `docker compose up` healthy; CI workflow valid. Tests: CI self-check; `/api/health` reachable.

---

## Milestone M1 — Data layer (needs D-01)

### D-02 · Natural Earth land pool seed
- Owner: data-engineer · Reqs: R01,R02 · Deps: D-01 · Files: `backend/prisma/data/ne_110m_land.json` (vendored, public domain), `backend/prisma/seed.ts`, `backend/src/modules/locations/pool.ts`
- Deliverable: offline seed that point-in-polygon-samples ~2000 land points, excludes `lat<-60`,
  tags `region` (6-way), stratified ~equally, writes `Location` rows (`source=grid`).
- AC: `prisma db seed` yields ≥1800 rows, all `isLand=true`, every region represented, none in ocean
  (spot-checked against polygons). Tests: U test on the point-in-polygon + region-tag helpers (pure).

### D-03 · Weather client + cache + validation
- Owner: data-engineer · Reqs: R03,R06,R13 · Deps: D-01 · Files: `backend/src/modules/weather/{client.ts,cache.ts,validate.ts,types.ts}`
- Deliverable: `WeatherClient` interface + Open-Meteo impl (exact call, architecture.md §11);
  `getFreshSnapshot(locationId)` returns a ≤1h snapshot or fetches+stores one; `validate()` for the
  4 mandatory fields; bounded retry (3×, 250/500/1000ms). Weather client is injectable.
- AC: valid payload → snapshot persisted+returned; incomplete → invalid; reuse within TTL. Tests:
  R03, R13 (U, stubbed client).

---

## Milestone M2 — Core solo loop (MVP core)

### B-02 · Domain: distance + scoring  ∥
- Owner: backend · Reqs: R09,R10 · Deps: F-01 · Files: `backend/src/domain/{distance.ts,scoring.ts}`
- Deliverable: pure haversine + scoring per architecture.md §12.
- AC: exact vectors. Tests: R09, R10 (U).

### B-03 · Domain: selection core  ∥
- Owner: backend · Reqs: R01,R02,R05,R07 · Deps: F-01 · Files: `backend/src/domain/selection.ts`
- Deliverable: pure `selectRound({difficulty, mode, pool, usedIds, previousActuals, rng})` →
  `{actual, candidates, selectionMode}` per ADR-0008 (RNG injected).
- AC: respects region/scope/no-repeat/separation/candidate counts. Tests: R01/R02/R05/R07 (U).

### B-04 · Locations service (pool queries)
- Owner: data-engineer · Reqs: R01,R02 · Deps: D-01,D-02 · Files: `backend/src/modules/locations/service.ts`
- Deliverable: query pool by region/whole-world; provide `pool` + `usedIds` inputs to `selection.ts`.
- AC: returns land-only candidates; excludes used. Tests: I (with seeded DB).

### B-05 · Games module
- Owner: backend · Reqs: R04(token),B.6 · Deps: F-01,D-01 · Files: `backend/src/contracts/games.ts`, `backend/src/modules/games/{routes.ts,service.ts}`, `backend/src/plugins/auth.ts`
- Deliverable: `POST /api/games`, `GET /api/games/{id}`; token gen+hash (ADR-0011); `X-Player-Token`
  auth plugin; ownership→404.
- AC: contract-exact; token returned once; hash stored. Tests: ownership I; VALIDATION_ERROR I.

### B-06 · Rounds module + fallback + R04 DTO
- Owner: backend · Reqs: R01,R03,R04,R06,R07,R08,R13 · Deps: B-03,B-04,D-03,B-05 · Files: `backend/src/contracts/rounds.ts`, `backend/src/modules/rounds/{routes.ts,service.ts,dto.ts}`
- Deliverable: `POST /games/{id}/rounds`, `GET /rounds/{id}`; integrates selection+weather+fallback
  (R13→503 when exhausted); state-machine guards (§9); `dto.ts` is the **only** place round
  responses are built and **cannot** include actual coords (R04).
- AC: contract-exact; R04 holds on the wire; 409 guards. Tests: R04 (U+I+E), R13 path (I), state (I).

### B-07 · Guess + results + scoring wiring
- Owner: backend · Reqs: R08,R09,R10,R11 · Deps: B-02,B-06 · Files: `backend/src/contracts/results.ts`, `backend/src/modules/rounds/guess.ts`, `backend/src/modules/results/{routes.ts,service.ts}`
- Deliverable: `POST /rounds/{id}/guess` (atomically writes Guess+Result, reveals actual, R11);
  `GET /games/{id}/results`, `GET /results/{id}`; one-guess-per-round (409).
- AC: reveal only here; totals correct. Tests: lifecycle I, double-guess 409 I.

### W-02 · Game view + weather panel + reveal
- Owner: frontend · Reqs: R06,R08,R11,R15 · Deps: F-02 · Files: `frontend/src/features/game/**`, `frontend/src/components/WeatherPanel.tsx`
- Deliverable: round screen; weather panel renders the 4 fields in a **consistent fixed layout**
  (R15); submit; reveal view (distance/score/actual). Uses stubbed/dev API or MSW until B-06/B-07.
- AC: layout stable across rounds; matches contract. Tests: WeatherPanel layout U (RTL); reveal U.

### W-03 · Leaflet map selection (MVP map mode)
- Owner: frontend · Reqs: R07 · Deps: W-02 · Files: `frontend/src/features/map/**`
- Deliverable: Leaflet map (react-leaflet), click to drop/move a marker until submit (R08 client
  state), emits `{lat,lon}`; tile URL + attribution from env.
- AC: marker movable pre-submit; guess emitted. Tests: map interaction U (RTL/mock).

---

## Milestone M3 — MVP completion

### W-04 · List selection mode  ∥
- Owner: frontend · Reqs: R07 · Deps: W-02 · Files: `frontend/src/features/list/**`
- AC: renders `candidates`, select one → `{lat,lon}`. Tests: U.

### W-05 · Difficulty UI  ∥
- Owner: frontend · Reqs: R05 · Deps: W-02 · Files: `frontend/src/features/difficulty/**`
- AC: Easy/Medium/Hard selectable; Easy→list-only, Hard→map-only, Medium→toggle. Tests: U.

### Q-01 · MVP integration + e2e suite
- Owner: qa · Reqs: R01–R11,R13,R15 · Deps: B-07,W-03 · Files: `backend/test/integration/**`, `e2e/**`
- Deliverable: all I/E rows for MVP in TESTING-CHECKLIST.md.
- AC: green in CI against compose. Tests: the suite itself (DoD gate for MVP).

---

## Milestone M4 — Fast-follow

### B-08 · Prefetch (1 round ahead)  ∥
- Owner: backend · Reqs: R12 · Deps: B-06 · Files: `backend/src/modules/rounds/prefetch.ts`
- AC: next location+snapshot warmed and reused (architecture.md §6a). Tests: R12 (I).

### B-09 · Retention purge cron  ∥
- Owner: backend · Reqs: R18 · Deps: B-07,D-01 · Files: `backend/src/scheduler/purge.ts`
- AC: daily 03:00 UTC purge of >6mo results; pool untouched. Tests: R18 (I).

### W-06 · Tutorial  ∥
- Owner: frontend · Reqs: R14 · Deps: W-02 · Files: `frontend/src/features/tutorial/**`
- AC: explains mechanics/selection/scoring; reachable. Tests: E (R14).

---

## Milestone M5 — Challenges + deployment prep

### B-10 · Async challenges + leaderboard
- Owner: backend · Reqs: R16 · Deps: B-07 · Files: `backend/src/contracts/challenges.ts`, `backend/src/modules/challenges/{routes.ts,service.ts}`
- AC: shared round; leaderboard isolated to its round (409 otherwise); public leaderboard. Tests: R16 (I).

### W-07 · Challenge UI + leaderboard  ∥
- Owner: frontend · Reqs: R16 · Deps: B-10(contract),W-02 · Files: `frontend/src/features/challenge/**`
- AC: create+share+join+leaderboard. Tests: E (R16).

### B-11 · Admin endpoints + guard
- Owner: backend · Reqs: B.14 · Deps: B-05,D-02,D-03 · Files: `backend/src/modules/admin/**`, `backend/src/plugins/auth.ts` (bearer)
- AC: `/api/admin/*` bearer-guarded; refresh/prefetch work. Tests: B.14 admin-guard (I, parametrized).

### O-02 · Deployment prep (R17) — no purchase/publish
- Owner: devops · Reqs: R17 · Deps: O-01 · Files: `docker-compose.prod.yml`, reverse-proxy (Caddy/Traefik) config, deploy README
- AC: TLS-ready reverse proxy config + prod compose; tile provider finalized in ADR-0007 at deploy.
  **Do not purchase domain or publish** (decision B.7). Tests: compose config validates.

### Q-02 · Full-suite + traceability closeout
- Owner: qa · Reqs: R01–R20 · Deps: all · Files: `e2e/**`, update `../requirements/traceability-matrix.md` (test refs)
- AC: every R01–R20 maps to a passing test; CI fully green. Tests: the complete suite.

---

## Parallelism map (what can run at once)
- **Wave 0 (M0):** F-01 ∥ F-02 ∥ D-01 ∥ O-01 (4 agents at once; respects `maxSpawnDepth`/3-concurrent).
- **Wave 1:** D-02 ∥ D-03 (after D-01) ∥ B-02 ∥ B-03 ∥ W-02 (after F-02).
- **Wave 2:** B-04 → B-05 → B-06 → B-07 (backend chain) ∥ W-03 (after W-02).
- **Wave 3 (M3):** W-04 ∥ W-05 ∥ Q-01.
- **Wave 4 (M4):** B-08 ∥ B-09 ∥ W-06.
- **Wave 5 (M5):** B-10 → W-07 ∥ B-11 ∥ O-02 → Q-02.
Concurrency is capped at 3 running subagents (agent-ownership.md); the orchestrator schedules
within each wave accordingly.
