# TerraGuessr

A geography guessing game: Google Street View panoramas, a guessing map,
weather/geographic clues, and scoring based on guess distance. React +
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
- **Singleplayer** (`/game/singleplayer`): Street View round play, map or
  list-based guessing, scoring, round progression and results.
- **Duels** (`/duels`): asynchronous challenge rounds — create a challenge
  from a round, join by link/code, compare results. No live/ranked
  matchmaking.
- **Daily challenge** (`/daily`): one shared challenge per UTC day.
- **Auth** (`/auth`): email/password accounts (scrypt-hashed, session
  cookies) plus a Google sign-in button gated behind OAuth credentials.
- **Settings** (`/settings`): account (rename/delete) and preference tabs.

See `docs/TERRAGUESSR-2.0-FEATURE-MATRIX.md` for the larger, explicitly
unmerged `feature/terraguessr-v2` scope (ranked matchmaking, live rooms,
etc.) — that matrix does not describe this branch.

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL, and the backend container)
- A Google Cloud project with the **Maps JavaScript API** and **Street View
  Static API** enabled (for interactive gameplay)

## Environment variables

Copy `.env.example` to `.env` at the repo root (backend/Docker Compose
values) and `frontend/.env.example` to `frontend/.env.local` (frontend/Vite
values). Both files are commented with what each variable does and which are
required vs. optional. Google OAuth sign-in and password-recovery email are
feature-flagged off until their respective credentials are set — nothing
else requires them.

**Never commit `.env` or `.env.local`.** `VITE_GOOGLE_MAPS_API_KEY` is a
public, HTTP-referrer-restricted browser key; never reuse
`GOOGLE_MAPS_SERVER_API_KEY` (server-only) as a `VITE_*` value.

## Development

Backend + database (Docker):

```sh
cp .env.example .env   # fill in ADMIN_API_TOKEN at minimum
docker compose up --build
```

Frontend (runs separately, proxies `/api` to the backend container):

```sh
cd frontend
cp .env.example .env.local   # fill in VITE_GOOGLE_MAPS_API_KEY
npm install
npm run dev
```

The frontend has no production Docker image yet — see the notes in
`Caddyfile` / `docker-compose.prod.yml` / `docker-compose.test.yml`.

## Commands

| Area | Typecheck/build | Lint | Unit tests |
|---|---|---|---|
| `frontend/` | `npm run build` (`tsc -b && vite build`) | `npm run lint` (oxlint) | `npm test` (vitest) |
| `backend/` | `npm run typecheck`, `npm run build` | `npm run lint` (eslint) | `npm test`, `npm run test:integration` |

End-to-end (Playwright, from the repo root): `npm run test:e2e`. CI runs this
against `docker-compose.test.yml`; for local runs against the Vite dev
server instead, see the note at the top of `docker-compose.test.yml`.

Other root scripts: `npm run maps:doctor` (sanity-checks local Google Maps
API key setup) and `npm run maps:verify` (smoke-checks a running game
server).

## Deployment

See `docs/deploy.md` for the production procedure
(`docker-compose.prod.yml` + Caddy). Requires Product Owner approval before
provisioning a real domain (see that file for details).
