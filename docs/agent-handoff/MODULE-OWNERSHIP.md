# MODULE-OWNERSHIP.md — File ownership & boundaries

Status: frozen (Phase 1). Purpose: give every file exactly **one owning agent** so the 7 DeepSeek
agents can work in parallel with zero shared-file write conflicts. Extends
`../process/agent-ownership.md` (roles) with concrete paths. Rule: **an agent only writes files it
owns.** Cross-module needs go through the frozen contracts (API-CONTRACTS.md, this file,
data-model.md), never by editing another agent's files.

## Repository layout (monorepo, two independent npm projects — not a workspace)

```
/                                   # root: e2e + compose + docs
├─ package.json  package-lock.json  # DEVOPS — @playwright/test only
├─ playwright.config.ts             # DEVOPS
├─ docker-compose.yml  docker-compose.test.yml   # DEVOPS
├─ .env.example                     # DEVOPS (keys) + each owner documents its vars
├─ .github/workflows/ci.yml         # DEVOPS
├─ e2e/                             # QA — Playwright specs
├─ backend/
│  ├─ package.json  tsconfig.json  .eslintrc    # BACKEND
│  ├─ prisma/schema.prisma          # DATA-ENGINEER (schema) — see split note below
│  ├─ prisma/migrations/            # DATA-ENGINEER
│  ├─ prisma/seed.ts                # DATA-ENGINEER
│  ├─ prisma/data/ne_110m_land.json # DATA-ENGINEER (vendored Natural Earth, public domain)
│  ├─ src/
│  │  ├─ server.ts  app.ts          # BACKEND (app factory, plugin wiring)
│  │  ├─ config/env.ts constants.ts # BACKEND
│  │  ├─ db/prisma.ts               # BACKEND (PrismaClient singleton)
│  │  ├─ plugins/{errorHandler,auth,cors}.ts   # BACKEND
│  │  ├─ contracts/*.ts             # BACKEND (TypeBox = runtime contract source)
│  │  ├─ domain/{distance,scoring,selection}.ts # BACKEND (pure, no I/O)
│  │  ├─ modules/games/*            # BACKEND
│  │  ├─ modules/rounds/*           # BACKEND
│  │  ├─ modules/results/*          # BACKEND
│  │  ├─ modules/challenges/*       # BACKEND
│  │  ├─ modules/locations/*        # DATA-ENGINEER (pool query/selection service)
│  │  ├─ modules/weather/*          # DATA-ENGINEER (Open-Meteo client, cache, validation)
│  │  ├─ modules/admin/*            # BACKEND (routes) — calls locations/weather services
│  │  └─ scheduler/{purge}.ts       # BACKEND
│  └─ test/
│     ├─ unit/**                    # owner of the code under test writes these
│     └─ integration/**             # QA (+ owner assists)
└─ frontend/
   ├─ package.json tsconfig.json vite.config.ts index.html .eslintrc  # FRONTEND
   ├─ src/
   │  ├─ main.tsx App.tsx           # FRONTEND
   │  ├─ api/{client,types}.ts      # FRONTEND (types.ts mirrors API-CONTRACTS.md)
   │  ├─ state/gameStore.tsx        # FRONTEND (Context + useReducer)
   │  ├─ features/game/*            # FRONTEND (round view, weather panel R15, reveal R11)
   │  ├─ features/map/*             # FRONTEND (Leaflet R07 map mode)
   │  ├─ features/list/*            # FRONTEND (R07 list mode)
   │  ├─ features/difficulty/*      # FRONTEND (R05)
   │  ├─ features/tutorial/*        # FRONTEND (R14)
   │  ├─ features/challenge/*       # FRONTEND (R16 leaderboard UI)
   │  └─ components/*  lib/*        # FRONTEND
   └─ test/**                       # FRONTEND unit (Vitest + RTL)
```

## Ownership summary

| Agent | Owns (writes) | Never writes |
|---|---|---|
| **architect** | `docs/**` (ADRs, contracts, this handoff) | any `src/**`, `prisma/**` |
| **backend** | `backend/src/**` except `modules/locations`, `modules/weather`; `backend/package.json`, configs; backend unit tests for its code | `prisma/**`, `frontend/**`, CI, compose |
| **data-engineer** | `backend/prisma/**`, `backend/src/modules/locations/**`, `backend/src/modules/weather/**`, their unit tests | other `backend/src/**`, `frontend/**` |
| **frontend** | `frontend/**` | `backend/**`, `prisma/**`, CI, compose |
| **qa** | `e2e/**`, `backend/test/integration/**`, acceptance tests; reviews all PRs | feature source it reviews |
| **devops** | root `package.json`, `playwright.config.ts`, `docker-compose*.yml`, `.env.example`, `.github/**`, `backend`/`frontend` Dockerfiles | feature source, prisma schema |
| **orchestrator (main)** | nothing directly — coordinates, merges | all source (delegates) |

## The one shared-boundary risk and its rule

`backend/prisma/schema.prisma` is owned by **data-engineer**, but **backend** needs the generated
Prisma client types. Rule: the schema is **frozen** in `data-model.md` (authoritative). Data-engineer
transcribes it verbatim in Task D-01 **first** (milestone M0), runs `prisma generate`, and commits.
Backend consumes the generated client read-only and never edits the schema. Any schema change is an
architect-approved `data-model.md` edit, then a data-engineer migration — never a direct backend edit.

Likewise `backend/src/contracts/*` (TypeBox) is **backend**-owned and frozen from API-CONTRACTS.md;
`frontend/src/api/types.ts` is **frontend**-owned and mirrors the same doc. They are independent
files — no shared write path — reconciled only by the QA contract-conformance test.
