# TerraGuessr frontend

React 19 + TypeScript + Vite SPA, routed with `react-router-dom`. See the
repo root `README.md` for the overall project, environment variables, and
how to run the backend this talks to.

## Structure

```
src/api/          Typed REST client functions (one file per backend module)
src/components/   Shared UI primitives, the cosmic background, the map picker
src/hooks/        Reusable hooks (auth form state, etc.)
src/pages/        One directory per route (auth, challenge, daily, duels,
                   home, play, settings, singleplayer)
src/state/        React context providers (session)
src/assets/       Per-page images/SVGs/GLB models
```

Routes are declared in `src/App.tsx`; every page below `/` is lazy-loaded.

## Commands

```sh
npm install
npm run dev        # Vite dev server, proxies /api to VITE_DEV_API_PROXY_TARGET
npm run build       # tsc -b && vite build
npm run lint         # oxlint
npm test              # vitest run
npm run preview        # preview a production build locally
```

## Environment

Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_API_KEY` (a
public, HTTP-referrer-restricted browser key — see the repo root README for
how this differs from the server-side Maps key). `VITE_DEV_API_PROXY_TARGET`
points the dev server at a running backend (defaults assume the Docker
Compose backend on port 3000/3004 depending on `BACKEND_HOST_PORT`).

## Testing

Unit/component tests (`*.test.ts(x)`, co-located with source) run via
`npm test` (Vitest + Testing Library + jsdom). Full end-to-end coverage
(Playwright) lives in `../e2e` and is run from the repo root.
