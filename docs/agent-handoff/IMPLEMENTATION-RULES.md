# IMPLEMENTATION-RULES.md — Rules every agent follows

Status: frozen (Phase 1). Read once; do not re-derive. These rules exist to keep the $20 DeepSeek
budget intact by removing exploration and rework.

## 0. Golden rules
1. **Do not make architecture decisions.** Everything you need is in `docs/architecture/**` and
   `docs/agent-handoff/**`. If a decision seems missing, STOP and report to the orchestrator — do
   not invent one, do not explore alternatives. Inventing decisions is the #1 budget killer.
2. **Write only files you own** (MODULE-OWNERSHIP.md). Need something from another module? Use the
   frozen contract, not their source.
3. **One task = one branch = one PR.** Branch name `<agent>/<task-id>-<slug>` (git-workflow.md).
4. **Never commit to `main` directly.** Never commit secrets (R19). `.env` is gitignored.
5. **Keep context small:** load only your task card, the contracts you touch, and the files you
   own. Do not read the whole repo.

## 1. Sanctioned dependency set (requires ONE Product-Owner approval, then frozen)
No dependency outside this list may be added without architect+PO approval (agent-ownership.md).
This single list is a financial checkpoint — approve once, before M0.
- **backend:** `fastify`, `@fastify/cors`, `@fastify/type-provider-typebox`, `@sinclair/typebox`,
  `@prisma/client`, `prisma` (dev), `node-cron`, `vitest` (dev), `tsx` (dev), `typescript` (dev),
  `eslint` + `@typescript-eslint/*` (dev). HTTP: use Node 22 global `fetch` — **no** http client dep.
- **frontend:** `react`, `react-dom`, `leaflet`, `react-leaflet`, `@types/leaflet` (dev),
  `vite`, `@vitejs/plugin-react`, `typescript` (dev), `vitest` (dev),
  `@testing-library/react` + `@testing-library/jest-dom` (dev), `jsdom` (dev), eslint set (dev).
  State: **React Context + `useReducer` only** — no Redux/Zustand (stays within approved stack).
- **root:** `@playwright/test` (dev).

## 2. Language / tooling conventions
- TypeScript `strict: true` everywhere. Node 22. ES modules (`"type": "module"`).
- No `any` in exported signatures. Domain functions in `backend/src/domain/**` are **pure**: no
  I/O, no `Date.now()` inside the formula, RNG injected as a parameter.
- Backend: every route declares TypeBox `body`/`params`/`querystring`/`response` schemas; a single
  `setErrorHandler` emits the ADR-0009 envelope. No `console.log`; use Fastify logger at `LOG_LEVEL`.
- Frontend: function components + hooks. All server I/O through `src/api/client.ts`. Tile URL,
  API base, attribution come from `import.meta.env` (never hardcoded). Leaflet map and list modes
  both emit the same `{lat,lon}` guess (ADR-0008).
- The weather client is an **interface** (`WeatherClient`) injected into services so tests stub it
  (ADR-0012). Never call `fetch('api.open-meteo…')` directly from a service body.

## 3. Determinism & secrets
- Secrets only from env (R19). Never log or return secrets; error envelopes never include stack
  traces or `DATABASE_URL`.
- `playerToken`: hash with SHA-256 before storing; compare hashes (ADR-0011). Admin bearer compared
  with `crypto.timingSafeEqual`.
- Actual coordinates (R04): the round DTO builder lives in one place and physically cannot include
  `actualLat/Lon`; a unit + e2e test asserts their absence.

## 4. Git & PR discipline (budget-critical)
- Small PRs, one task each. PR body lists: Task ID, requirement IDs, what changed, how tested.
- CI must be green (lint + Vitest; e2e where applicable) before requesting QA review.
- QA (or a human) reviews; authors never approve their own PR (git-workflow.md).
- If CI fails, fix from the CI log — **do not** re-run agents to "re-explore"; the log is authoritative.

## 5. When blocked (saves money)
Report to the orchestrator with: task ID, the exact missing fact, and the doc you already checked.
Do not spin. A 2-line question to `main` is cheaper than an agent exploring for 20k tokens.

## 6. Out of scope (do not build — decision B.10)
Flights, earthquakes, ranked PvP, real-time/WebSocket multiplayer, user accounts, timers, hints-
for-point-deduction. These are **not** in R01–R20. Building them wastes budget.
