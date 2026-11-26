# Production Infrastructure & Operations Runbook

This document records where TerraGuessr runs in production, how deployments and migrations are orchestrated, which external services and cron jobs exist outside the repository, and where each secret lives.

> **Security rule:** Never commit real secret values or credentials here. Document only secret *names* and where they are stored; keep actual values and dashboard logins in your password manager.

---

## 1. Hosting & External Services Inventory

| Component | Provider | Region / Endpoint | Plan | Config in Repo | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend SPA** | Vercel | Global CDN (`vercel.app` / custom domain) | Free | `frontend/vercel.json` | Serves the Vite static build and rewrites `/api/:path*` to the Render backend. Git auto-deploy on `main` is disabled. |
| **Backend API** | Render | Frankfurt (`https://terraguessr-api.onrender.com`) | Free Web Service (Docker) | `render.yaml`, `backend/Dockerfile` | Fastify + Prisma API. `autoDeployTrigger: "off"` — deploys are driven exclusively by GitHub Actions. |
| **Database** | Neon | `eu-central-1` (Frankfurt) | Free (PostgreSQL 16) | `backend/prisma/schema.prisma` | Primary PostgreSQL database. Uses the **direct** (unpooled) connection string with `?sslmode=require`. |
| **Keep-Alive Pinger** | cron-job.org *(external)* | External HTTP cron | Free | *(external dashboard)* | Sends `GET https://terraguessr-api.onrender.com/api/health` every 10–14 min so Render Free does not spin down after 15 min idle. |
| **Primary Weather & Elevation** | Open-Meteo | `https://api.open-meteo.com` | Free (no key) | `backend/src/modules/intelligence/service.ts` | Live weather clues & elevation relief data (cached in-memory for 15 min / 30 days). |
| **Fallback Weather** | MET Norway | `https://api.met.no` | Free (no key, custom User-Agent) | `render.yaml`, `backend/src/modules/intelligence/service.ts` | Automatic fallback when Open-Meteo fails or rate-limits. |
| **Map Tiles** | Esri ArcGIS Online | `server.arcgisonline.com` | Free (no key) | `frontend/src/components/game/GuessMap.tsx` | World Street Map & World Physical Map raster tiles loaded directly by the browser. |
| **Email Delivery** *(optional)* | External SMTP | Configured via `SMTP_URL` | — | `render.yaml` | Email verification, email change, and password recovery emails. |
| **Google OAuth** *(optional)* | Google Cloud Console | Configured via `GOOGLE_*` | Free | `render.yaml` | Optional Google sign-in. |

---

## 2. Scheduled Jobs & Warm-Up Automation

### External Cron Job (Keep-Alive)
- **Tool:** `cron-job.org` (configured in the `cron-job.org` dashboard)
- **Request:** `GET https://terraguessr-api.onrender.com/api/health`
- **Schedule:** Every **10 minutes**
- **Why `/api/health` and not `/api/ready`:**
  - `/api/health` is exempt from rate limits, responds in milliseconds, and **does not query PostgreSQL**. That keeps Render warm while letting Neon scale to zero when nobody is playing (protecting Neon's free compute-hour quota).
  - Pinging `onrender.com` directly avoids burning Vercel proxy/origin-transfer quota.

### In-Process Backend Jobs & Warm-Up
- **Hourly session cleanup (`0 * * * *` UTC):** `backend/src/scheduler/index.ts` purges expired singleplayer games and lobbies.
- **Daily retention & auth cleanup (`0 3 * * *` UTC):** `backend/src/scheduler/index.ts` enforces the 6-month archive retention policy and deletes expired auth tokens/sessions.
- **Round 1 warm pool (`backend/src/modules/singleplayer/warmPool.ts`):**
  - Primed automatically on server startup (`onListen` in `backend/src/app.ts`) and lazily via `POST /api/singleplayer/warm` when a user hovers **Singleplayer** or visits `/singleplayer`.
  - Buffers up to 3 pre-validated Round 1 locations in memory (TTL 14 min, aligned under `weatherCache`'s 15-min TTL) so clicking **Start exploring** avoids waiting on Open-Meteo.

---

## 3. Secrets & Environment Variables Map

### GitHub Actions (`Repository Settings → Secrets and variables → Actions`)

| Name | Type | Required When | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Secret | Backend deploys | Neon direct PostgreSQL URL used by CI to run `npx prisma migrate deploy` before Render deploys. |
| `RENDER_DEPLOY_HOOK_URL` | Secret | Backend deploys | Render Deploy Hook URL to trigger a new backend container build. |
| `VERCEL_DEPLOY_HOOK_URL` | Secret | Frontend deploys | Vercel Deploy Hook URL to trigger a new frontend build. |
| `RENDER_API_BASE_URL` | Variable *(optional)* | Never required unless overriding | Overrides the Render origin derived from `frontend/vercel.json` for `/api/health` commit polling. |

### Render (`terraguessr-api → Environment`)

| Name | Managed In | Notes |
| :--- | :--- | :--- |
| `NODE_ENV`, `SESSION_COOKIE_SECURE`, `TRUST_PROXY`, `LOG_LEVEL`, `OPEN_METEO_BASE_URL`, `MET_NO_BASE_URL` | `render.yaml` | Synced from the Render Blueprint. |
| `DATABASE_URL` | Render Dashboard (`sync: false`) | Same Neon direct PostgreSQL connection string as in GitHub Actions. |
| `APP_BASE_URL`, `CORS_ORIGIN` | Render Dashboard (`sync: false`) | Public Vercel origin (e.g. `https://terraguessr.vercel.app`, no trailing slash). |
| `SMTP_URL`, `SMTP_FROM` | Render Dashboard (`sync: false`) | Optional; enables outbound verification/recovery emails. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Render Dashboard (`sync: false`) | Optional; all three must be set together to enable Google sign-in. |
| `RENDER_GIT_COMMIT` | Render *(automatic)* | Automatically injected by Render on every deploy; exposed via `GET /api/health` (`commit`) for CI deploy verification. |

---

## 4. Deployment Flow (Backend-First)

Production deploys run automatically on every `push` to `main` via `.github/workflows/ci.yml`:

1. **Change detection (`changes`)** determines which targets (`backend`, `frontend`, `e2e`, `deploy_backend`, `deploy_frontend`) need to run.
2. **Checks (`backend` + `frontend` in parallel, then `e2e`)** run linting, typechecking, production builds, unit/integration tests, and Playwright E2E tests against `docker-compose.test.yml`.
3. **Production deploy (`deploy`, serialized via `concurrency: deploy-production`)**:
   1. Validates required GitHub Actions secrets.
   2. If backend changed: runs `npm run db:init` (`prisma migrate deploy`) against Neon **synchronously**. If this fails, neither Render nor Vercel is triggered.
   3. If backend changed: triggers `RENDER_DEPLOY_HOOK_URL` and polls `GET /api/health` every 10 seconds (up to 15 minutes) until `.commit === github.sha`.
   4. If frontend changed: triggers `VERCEL_DEPLOY_HOOK_URL` **only after** the new backend commit is confirmed live (eliminating new-frontend → old-backend version skew).

### Schema & API Compatibility Rule (Expand-and-Contract)
Because the old backend container continues serving traffic for ~2–4 minutes after CI runs `prisma migrate deploy` (while Render builds the new image), and open browser tabs may still run the previous frontend bundle:
- Make database migrations **additive / backward-compatible** first (add nullable columns or defaults before removing old columns in a later deploy).
- Keep backend API changes backward-compatible with the previous frontend bundle during rollout.

---

## 5. Free-Tier Quotas & Troubleshooting

- **Render Free (750 instance hours/month per workspace):** A 31-day month has 744 hours (`31 × 24`). If `terraguessr-api` is your only free Render web service, 24/7 keep-alive fits inside 750 hours. If you add another free Render web service in the same workspace, restrict the `cron-job.org` schedule to active hours (e.g., `07:00–01:00`).
- **Neon Free compute hours:** Because the external keep-alive pings `/api/health` (no DB query), Neon scales to zero when idle and wakes on demand (~1–2s) when a user plays or signs in.
- **Health vs. Readiness checks:**
  - `GET https://terraguessr-api.onrender.com/api/health` — confirms Node is up and shows which `commit` SHA is live (no DB touch).
  - `GET https://terraguessr-api.onrender.com/api/ready` — confirms PostgreSQL connectivity (`SELECT 1`); used by Render's built-in health check during deploys.
- **If a deploy fails:**
  - **Migration failed in CI:** Neither Render nor Vercel was triggered; production is untouched. Fix the migration and push again.
  - **Render build/boot failed:** The CI wait loop times out after 15 minutes and aborts before triggering Vercel; check Render deploy logs.
  - **Manual rollback:** Both Render and Vercel support one-click rollbacks to a previous deployment in their dashboards (ensure the database schema remains compatible with the rolled-back backend).
