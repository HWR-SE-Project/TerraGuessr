# Deployment guide (R17)

Step-by-step procedure for running TerraGuessr on a single production host with
Docker Compose and Caddy (automatic HTTPS).

> **Stop — approval gate (decision B.7).**
> This document describes *preparation*. Do **not** purchase a domain, rent a
> server, point DNS at a live host, or otherwise publish this application
> without explicit Product Owner approval. Everything below that costs money or
> makes the app publicly reachable is gated on that approval. No images are
> pushed to a registry by this task either — the stack builds on the host.

Stack: `postgres` + `backend` (Fastify) + `frontend` (nginx) + `caddy`
(TLS termination and reverse proxy). Only Caddy publishes ports; the database
and app containers are reachable only on the compose network.

| File | Purpose |
| --- | --- |
| `docker-compose.prod.yml` | Production compose file (no dev mounts, restart policies) |
| `Caddyfile` | TLS + routing: `/api/*` → backend, everything else → frontend |
| `.env` | Local, gitignored configuration (created from `.env.example`) |
| `docs/architecture/adr/0007-map-tile-provider.md` | Tile provider decision (finalized at deploy) |

---

## 1. Prerequisites

- A Linux host (Debian/Ubuntu LTS recommended) with a public IPv4 address,
  Docker Engine 24+ and the Docker Compose v2 plugin.
- Inbound TCP 80 and 443 open (Caddy needs 80 for the ACME HTTP challenge and
  for redirects; 443 for HTTPS). UDP 443 optional (HTTP/3).
- Outbound HTTPS from the host: the backend calls Open-Meteo, Caddy talks to
  Let's Encrypt, and the image build pulls packages.
- A domain or subdomain whose DNS you control — **only after PO approval**.
- ~1 GB RAM minimum (2 GB recommended), a few GB of disk for images,
  Postgres data, and certificates.

Install Docker (example, Ubuntu):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # re-login afterwards
docker compose version
```

## 2. Get the code

```bash
git clone <repository-url> terraguessr
cd terraguessr
```

Deploy the commit/tag approved for release; do not deploy a dirty working tree.

## 3. Configure environment variables

`.env` is gitignored (`.gitignore` ignores `.env` and `.env.*`). Create it
from the authoritative example and edit it on the server only:

```bash
cp .env.example .env
chmod 600 .env
```

Required production values (compose refuses to start without them):

| Variable | Required | Notes |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | Long random value; URL-safe characters only (it is embedded in `DATABASE_URL`). Generate: `openssl rand -base64 32 \| tr '+/' '-_'` |
| `ADMIN_API_TOKEN` | yes | Long random bearer token for `/api/admin/*` (ADR-0011). Generate: `openssl rand -hex 32` |
| `DOMAIN` | yes | Hostname Caddy serves, e.g. `terraguessr.example.com` (placeholder). No scheme, no trailing slash. |
| `ACME_EMAIL` | yes | Contact address for Let's Encrypt expiry notices. |
| `VITE_TILE_URL` | yes | XYZ tile template, e.g. the OSM default already present in `.env.example`. Finalize per §8 before launch. |

Optional / defaulted:

| Variable | Default | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | `terraguessr` | Database user. |
| `POSTGRES_DB` | `terraguessr` | Database name. |
| `PORT` | `3000` | Backend listen port inside the network. |
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com` | Weather provider (ADR-0003). |
| `LOG_LEVEL` | `info` | `warn` reduces log volume. |
| `VITE_API_BASE_URL` | `/api` | Same-origin API path; keep `/api` behind Caddy. |
| `VITE_MAP_ATTRIBUTION` | OSM + Open-Meteo | Required attribution (ADR-0003). |

Notes:

- `CORS_ORIGIN` is derived automatically as `https://$DOMAIN` in the prod
  compose file; the SPA and API are same-origin through Caddy.
- `DATABASE_URL` is also derived in compose so it points at the `postgres`
  service. The value in `.env` matters only for running the backend outside
  compose.
- `VITE_*` values are **build-time** (Vite inlines them). Changing one requires
  rebuilding the frontend image (`up -d --build frontend`).
- Never commit `.env`, and never reuse the example secrets.

## 4. DNS and firewall (approval required)

1. Create an `A` record (and `AAAA` if the host has IPv6) for `DOMAIN`
   pointing at the host's public IP. Example: `terraguessr.example.com → 203.0.113.10`.
2. Wait for propagation: `dig +short "$DOMAIN"`.
3. Open only the ports that are needed:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # optional, HTTP/3
sudo ufw enable
```

Do **not** expose 5432 (Postgres) or 3000 (backend): they are not published by
`docker-compose.prod.yml` and should stay firewalled.

Docker publishes ports through its own iptables rules, which can bypass `ufw`
rules for published ports. That is acceptable here because the only published
ports are Caddy's 80/443 — keep it that way and never add a `ports:` mapping
for Postgres or the backend in production.

## 5. Build and start

```bash
# Syntax-only check without touching .env (uses the example placeholders):
docker compose -f docker-compose.prod.yml --env-file .env.example config -q
# Real validation with your production values (fails fast on missing vars):
docker compose -f docker-compose.prod.yml config

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Compose exits with a clear error if `POSTGRES_PASSWORD`, `ADMIN_API_TOKEN`,
`DOMAIN`, `ACME_EMAIL`, or `VITE_TILE_URL` is missing — that is intentional,
so a misconfigured host never starts with placeholder credentials or an empty
tile endpoint (an empty tile URL would yield a blank map, not a crash).

The backend container runs `prisma migrate deploy` before starting the server,
so pending migrations are applied on every deploy (see `backend/Dockerfile`).
It then runs `prisma db seed` (`backend/prisma/seed.ts`), which populates the
`Location` pool (~2000 land points) on first start. The seed is idempotent —
it checks the existing row count and skips the sampling work once the pool is
already populated, so restarts and redeploys do not re-seed unnecessarily
(set `SEED_FORCE=1` on the backend container to force a reseed). This means a
fresh environment can start a game immediately after `up -d --build`, with no
manual seed command.

Watch startup and certificate issuance:

```bash
docker compose -f docker-compose.prod.yml logs -f backend caddy
```

Wait for all healthchecks to report `healthy`, then verify:

```bash
curl -fsS "https://$DOMAIN/api/health"
curl -fsSI "https://$DOMAIN/" | head -n 5
```

## 6. How TLS works (Caddy)

- Caddy reads `Caddyfile` (mounted read-only) and uses the `DOMAIN` and
  `ACME_EMAIL` environment variables from `.env`.
- On the first HTTPS request it obtains a Let's Encrypt certificate via the ACME
  HTTP-01 challenge (or TLS-ALPN-01), stores it in the `caddy_data` volume, and
  renews it automatically. No cron job or certbot is needed.
- Requirements: DNS already points at the host, ports 80/443 are reachable from
  the internet, and the host clock is correct.
- To test without burning Let's Encrypt production rate limits, uncomment the
  `acme_ca` staging line in `Caddyfile`, start the stack, and confirm HTTPS
  works (browsers will warn about the staging CA). Then comment it out again,
  remove the volume, and restart to get a real certificate:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm terraguessr-prod_caddy_data
docker compose -f docker-compose.prod.yml up -d
```

- Certificate data survives container restarts because it lives in the named
  volume; back that volume up along with the database if you want fast recovery.

## 7. Operating the stack

**Update / redeploy**

```bash
git pull                     # or check out the approved tag
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

**Logs**

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200
```

**Database backup / restore**

```bash
# backup (the container already has POSTGRES_USER / POSTGRES_DB from .env)
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "backup-$(date +%F).sql.gz"

# restore (into an empty database)
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

**Restart / stop**

```bash
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down          # keeps volumes
docker compose -f docker-compose.prod.yml down -v       # DESTROYS data — avoid
```

**Rollback:** check out the previous approved tag and run
`up -d --build`. Database migrations are forward-only; if a release changed the
schema, restore the matching backup instead of downgrading blindly.

## 8. Map tile provider (ADR-0007) — finalize before going live

The code is provider-agnostic (Leaflet + `VITE_TILE_URL`). The default in
`.env.example` is OpenStreetMap's public tile server, which is fine for light
demo/testing traffic but **not** for production-scale use under OSM's tile usage
policy.

Before the public launch:

1. Estimate expected traffic (rounds/day × map loads × tiles per view).
2. Re-check the candidate provider's current usage policy: self-hosted tile
   server, a managed OSM-compatible provider (e.g. MapTiler), or OSM's public
   server for genuinely low volume only.
3. Set `VITE_TILE_URL` (and `VITE_MAP_ATTRIBUTION` to match the provider and
   keep crediting Open-Meteo) in `.env`.
4. Rebuild the frontend: `docker compose -f docker-compose.prod.yml up -d --build frontend`.
5. Record the chosen provider and the policy check in
   `docs/architecture/adr/0007-map-tile-provider.md` (update the ADR).

If a provider requires an API key in the tile URL, treat that URL as a
low-sensitivity secret: it is inlined into the public frontend bundle, so use a
referrer/domain-restricted key and never a server-side secret.

## 9. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Compose exits with `POSTGRES_PASSWORD is required` (or similar) | `.env` missing or incomplete; copy `.env.example` and fill the required values. |
| Caddy logs `no certificate available` / ACME failures | DNS not pointing at the host, ports 80/443 blocked, or rate-limited; check `dig`, firewall, and Caddy logs. |
| `502` on `/` or `/api/*` | The target service is unhealthy; check `ps` and `logs backend`/`logs frontend`. |
| Backend restarts in a loop | `DATABASE_URL`/Postgres credentials wrong, or migrations failed — read backend logs. |
| `/api/health` works but API calls fail in the browser | Frontend was built with the wrong `VITE_API_BASE_URL`; rebuild with `/api`. |
| Port 80/443 already in use | Another web server (nginx/Apache) is bound; stop it or reconfigure it, Caddy must own these ports. |

## 10. Explicit non-actions (decision B.7)

Until the Product Owner approves the release, do not:

- purchase or renew a domain, TLS certificate, server, or paid tile plan;
- create public DNS records for a real domain;
- publish/expose the stack on a public IP;
- push images to a public registry.

Preparing `docker-compose.prod.yml`, the `Caddyfile`, and this guide is the
full scope of R17 preparation.
