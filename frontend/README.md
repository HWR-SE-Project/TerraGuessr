# TerraGuessr frontend

React 19 + TypeScript + Vite SPA, routed with `react-router-dom`. See the
repo root `README.md` for the overall project, environment variables, and
how to run the backend this talks to.

## Structure

```
src/api/          Typed REST client functions (one file per backend module)
src/components/   Shared UI primitives, the cosmic background, the map picker
src/hooks/        Reusable hooks (auth form state, etc.)
src/pages/        One directory per route (auth, home, lobby,
                   settings, singleplayer)
src/state/        React context providers (session)
src/assets/       Per-page images/SVGs/GLB models
```

Routes are declared in `src/App.tsx`; every page below `/` is lazy-loaded.

## Commands

```sh
npm install
npm run dev        # http://localhost:8080, proxies /api to the local backend
npm run typecheck  # tsc -b
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm test           # vitest run
npm run preview    # preview a production build locally
```

## Environment

Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_API_KEY` (a
public, HTTP-referrer-restricted browser key — see the repo root README for
how this differs from the server-side Maps key).

The dev server always runs at `http://localhost:8080` and proxies `/api` to
`http://localhost:<BACKEND_HOST_PORT>`, reading `BACKEND_HOST_PORT` from the
repo-root `.env` (default 3000). Change that one value if the port is taken;
`VITE_DEV_API_PROXY_TARGET` is only needed to override the target explicitly.

## Testing

Unit/component tests (`*.test.ts(x)`, co-located with source) run via
`npm test` (Vitest + Testing Library + jsdom). Full end-to-end coverage
(Playwright) lives in `../e2e` and is run from the repo root.
