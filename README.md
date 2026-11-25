# TerraGuessr

A geography guessing game: interactive 3D low-poly biome dioramas driven by
live Open-Meteo weather, an open-source Leaflet guessing map (CARTO Voyager),
customizable 3D explorer avatars, and geodesic distance scoring. React +
TypeScript frontend, Fastify + PostgreSQL (Prisma) backend.

## Repository structure

```
frontend/   React + TypeScript + Vite SPA (react-router-dom routing)
backend/    Fastify + Prisma/PostgreSQL REST API
e2e/        Playwright end-to-end specs (run against the whole stack)
scripts/    Dev tooling (maps-doctor, live-game smoke check)
docs/       Architecture, process, requirements and screenshot QA history
.github/    CI workflow
```

Both `frontend/` and `backend/` are independent npm projects (separate
`package.json`/lockfile each), not an npm workspace.

## Current feature status

- **Home page**: 3D hero scene (react-three-fiber) — rotating low-poly Earth,
  a rigged/animated explorer character with cursor head-tracking, cosmic
  starfield background. Falls back to a static image when WebGL is
  unavailable or the scene is still loading.
- **Singleplayer** (`/singleplayer`): 3D biome diorama round play, map or
  list-based guessing, scoring, round progression and results.
- **Multiplayer** (`/multiplayer`, `/lobby/:code`): live lobbies with a host,
  6-character join codes, shared 3D diorama rounds, difficulty-derived timers
  and attempts, and a shared in-match/final leaderboard.
- **Auth** (`/auth`): email/password accounts (scrypt-hashed, session
  cookies) plus a Google sign-in button gated behind OAuth credentials.
- **Settings** (`/settings`): account (rename/delete) and preference tabs.

See `docs/TERRAGUESSR-2.0-FEATURE-MATRIX.md` for the larger, explicitly
unmerged `feature/terraguessr-v2` scope (ranked matchmaking, live rooms,
etc.) — that matrix does not describe this branch.

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL, and the backend container)

## Environment variables

Copy both example files once:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

`.env` holds backend, database, Docker Compose and production values;
`frontend/.env.local` holds Vite/browser values. Both examples document every
variable and which ones are required. No map or weather API keys are required
for singleplayer or multiplayer gameplay. Google sign-in and real email
delivery stay disabled until their credentials are added; nothing else requires
them.

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

If a port is already taken, change it once in `.env`
(`BACKEND_HOST_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT`). Vite reads the root
`.env`, so changing `BACKEND_HOST_PORT` automatically updates its `/api` proxy;
there is no second frontend setting to keep in sync.

### Quick start

1. Install dependencies (first run and after dependency changes):

   ```sh
   npm install --prefix frontend
   ```

2. Start PostgreSQL, the backend and Mailpit:

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

Registration and password-reset emails are captured by Mailpit at
<http://localhost:8025> instead of being sent. To deliver real email, set
`SMTP_URL`/`SMTP_FROM` in `.env` and restart the backend; no rebuild is needed.

Stop the Docker services with `docker compose down` (keeps data). To wipe the
local database as well, use `docker compose down -v`.

### Full-stack test environment

`docker-compose.test.yml` starts the same application with hardcoded test
settings and deterministic weather: frontend on <http://localhost:8080>,
backend on <http://localhost:3000>, its own PostgreSQL volume, and a fake
weather service. This is what CI uses for Playwright:

```sh
docker compose -f docker-compose.test.yml up --build -d
npm run test:e2e
docker compose -f docker-compose.test.yml down -v
```

For production, `frontend/Dockerfile` builds the SPA into an nginx image that
Caddy serves alongside `/api` (see `docker-compose.prod.yml` / `Caddyfile`).

## Commands

| Area | Typecheck/build | Lint | Unit tests |
|---|---|---|---|
| `frontend/` | `npm run typecheck`, `npm run build` | `npm run lint` (oxlint) | `npm test` (vitest) |
| `backend/` | `npm run typecheck`, `npm run build` | `npm run lint` (eslint) | `npm test`, `npm run test:integration` |

End-to-end (Playwright, from the repo root): `npm run test:e2e`. `PLAYWRIGHT_BASE_URL`
defaults to <http://localhost:8080>; start either the Vite dev server or the
full-stack test compose file first.

Other root scripts: `npm run maps:doctor` (sanity-checks local Google Maps
API key setup) and `npm run maps:verify` (smoke-checks a running game
server).

## Deployment

See `docs/deploy.md` for the production procedure
(`docker-compose.prod.yml` + Caddy). Requires Product Owner approval before
provisioning a real domain. Production requires real `SMTP_URL` and `SMTP_FROM`
values in `.env`; Mailpit is opt-in via `--profile test-mail` for testing only.
