# TerraGuessr

A geography guessing game: interactive 3D low-poly biome dioramas driven by
live MET Norway weather and elevation data, an open-source Leaflet guessing map
(Esri World Street & Physical tiles), customizable 3D explorer avatars, and
geodesic (Haversine) distance scoring. React + TypeScript frontend, Fastify +
PostgreSQL (Prisma) backend.

## Repository structure

```
frontend/   React + TypeScript + Vite SPA (react-router-dom routing)
backend/    Fastify + Prisma/PostgreSQL REST API
e2e/        Playwright end-to-end specs (run against the whole stack)
scripts/    Dev and verification tooling
docs/       Requirements, production runbook, and UML diagrams
.github/    CI/CD workflow
```

Both `frontend/` and `backend/` are independent npm projects (separate
`package.json`/lockfile each), not an npm workspace.

## Features

- **Home page** (`/`): 3D hero scene (`@react-three/fiber`) — rotating low-poly
  Earth, a rigged/animated explorer character with cursor head-tracking, and a
  cosmic starfield background. Falls back cleanly when WebGL is unavailable or
  still loading.
- **Singleplayer** (`/singleplayer`, `/singleplayer/play`): 3D biome diorama
  rounds with Easy, Medium, and Hard difficulties, fixed round counts (3–10) or
  endless mode, candidate-city or interactive world-map guessing, Best-of-N
  attempts, optional extra weather/elevation data unlocks, and round/match
  summaries.
- **Multiplayer** (`/multiplayer`, `/lobby/:code`, `/lobby/:code/play`): live
  lobbies (2–16 players) with a host, 6-character join codes, host-selected
  difficulty and round count, synchronized 3D diorama rounds, private in-round
  HUD, shared 15-second review with all guesses revealed, live/final
  leaderboard, and rematch coordination.
- **Interactive Tutorial & Guides** (`/how-to-play`, `/how-to-play/tutorial`,
  `/how-to-play/guide`): 2-round guided practice tutorial (exit, skip, or
  restart anytime), interactive distance-to-score curve preview, and Ultimate
  Field Guide.
- **Statistics & Match History** (`/stats`): signed-in players' 6-month
  archived results with rolling KPI trends, streaks, biome and difficulty
  breakdowns, and interactive world-map match replays.
- **Avatar Editor** (`/avatar`): customizable 3D explorer character (saved on
  the current device for guests; synced to the account when signed in).
- **Authentication & Account** (`/auth`, `/account`, `/verify-email`,
  `/reset-password`, `/confirm-email-change`): email/password accounts
  (scrypt-hashed, HTTP-only session cookies, email verification, dual-inbox
  email change, password recovery, display name editing, and permanent account
  deletion) plus optional Google OAuth sign-in.
- **Settings & Privacy** (`/settings`, `/privacy`): game preferences
  (device-local for guests, account-synced when signed in) and a plain-language
  data-usage overview.

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL, Mailpit, and containerized runs)

## Environment variables

Copy both example files once:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

`.env` holds backend, database, Docker Compose, and production values;
`frontend/.env.local` holds optional Vite/browser overrides. Both examples
document every variable and which ones are required. No map or weather API keys
are required for singleplayer or multiplayer gameplay (MET Norway
Locationforecast 2.0 and Esri ArcGIS tiles are used without keys). Google
sign-in and real outbound email delivery stay disabled until their credentials
are configured; nothing else requires them.

**Never commit `.env` or `.env.local`.**

## Development

All local URLs use **`localhost`** — do not mix in `127.0.0.1` or other hosts.
The default ports are:

| Service | URL / address |
| --- | --- |
| Frontend (Vite) | <http://localhost:8080> |
| Backend API | <http://localhost:3000/api> |
| Mailpit inbox | <http://localhost:8025> |
| PostgreSQL | `localhost:5432` |
| Backend health check | <http://localhost:3000/api/health> |
| Backend readiness check | <http://localhost:3000/api/ready> |

If a port is already taken, change it once in `.env`
(`BACKEND_HOST_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT`). Vite reads the root
`.env`, so changing `BACKEND_HOST_PORT` automatically updates its `/api` proxy;
there is no second frontend setting to keep in sync.

### Quick start

1. Install dependencies (first run and after dependency changes):

   ```sh
   npm install --prefix frontend
   ```

2. Start PostgreSQL, the backend, and Mailpit:

   ```sh
   docker compose up --build -d
   docker compose ps                 # wait for postgres and backend: healthy
   curl http://localhost:3000/api/health
   ```

3. Start the frontend in a second terminal:

   ```sh
   npm run dev --prefix frontend
   ```

4. Open <http://localhost:8080>.

Registration, email-change, and password-reset emails are captured by Mailpit
at <http://localhost:8025> instead of being sent externally. To deliver real
email, set `SMTP_URL` and `SMTP_FROM` in `.env` and restart the backend; no
rebuild is needed.

Stop the Docker services with `docker compose down` (keeps data). To wipe the
local database as well, use `docker compose down -v`.

### Full-stack test environment

`docker-compose.test.yml` starts the application with hardcoded test settings
and deterministic weather: frontend on <http://localhost:8080>, backend on
<http://localhost:3000>, its own PostgreSQL volume (`5433`), and a fake MET
Norway weather service (`4001`). This is what CI uses for Playwright:

```sh
docker compose -f docker-compose.test.yml up --build -d
npm run test:e2e
docker compose -f docker-compose.test.yml down -v
```

## Commands

| Area | Typecheck / build | Lint | Unit / integration tests |
| --- | --- | --- | --- |
| `frontend/` | `npm run typecheck`, `npm run build` | `npm run lint` (oxlint) | `npm test` (vitest) |
| `backend/` | `npm run typecheck`, `npm run build` | `npm run lint` (eslint) | `npm test`, `npm run test:integration` |

End-to-end tests (Playwright, from the repo root): `npm run test:e2e`.
`PLAYWRIGHT_BASE_URL` defaults to <http://localhost:8080>; start either the
Vite dev server (with the backend running) or `docker-compose.test.yml` first.

Other root scripts: `npm run maps:doctor` and `npm run maps:verify` (live game
smoke check).

## Deployment

See [docs/production.md](docs/production.md) for the production architecture
and CI/CD runbook (Vercel frontend, Render Docker backend, Neon PostgreSQL,
backend-first migrations via GitHub Actions).

For self-hosted Docker deployment, `docker-compose.prod.yml` builds the SPA
into an nginx image (`frontend/Dockerfile`) served behind Caddy (`Caddyfile`)
alongside `/api`. Production compose requires real `SMTP_URL` and `SMTP_FROM`
values in `.env`; Mailpit is opt-in via `--profile test-mail` for testing only.
