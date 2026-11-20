# TerraGuessr: manual testing on macOS

This guide runs the local application from `main`. Docker Compose runs
PostgreSQL, the API and Mailpit; the frontend runs separately via Vite. All
local URLs use `localhost`. No manual migration or database seed is needed for
the backend. The application calls Open-Meteo for live weather and
OpenStreetMap for map tiles, so internet access is needed for normal play.

## Before you start

- Install Git, Docker Desktop for Mac, and Node.js 22+. Start Docker Desktop
  and wait until `docker compose version` works in Terminal.
- Have a modern browser (Chrome or Safari) and enough disk space for Docker
  images.
- The default ports must be free: frontend 8080, backend 3000, Mailpit 8025,
  PostgreSQL 5432. If one is taken, change the matching value in `.env` once
  (`BACKEND_HOST_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT`). The API still
  listens on port `PORT=3000` *inside* the Compose network.

## Get the code and configure it

For an existing checkout, run `git switch main` and `git pull --ff-only origin
main`, then keep your existing `.env`. Do not overwrite it with the example.
For a new checkout, clone this repository, then:

```bash
cp .env.example .env
chmod 600 .env
open -e .env
```

In the editor, set these values in `.env` before starting:

| Variable | What to set |
| --- | --- |
| `POSTGRES_PASSWORD` | A new, long, URL-safe random password. Replace the example value. |
| `ADMIN_API_TOKEN` | A different, long, random token. Replace the example placeholder. |
| `POSTGRES_PORT` | `5432` unless another local service already uses it. |
| `BACKEND_HOST_PORT` | `3000` unless another local service already uses it. Keep `PORT=3000` internally. |
| `DATABASE_URL` | If running backend tools directly on your Mac, use the same password and host port. Compose derives its own internal URL from `POSTGRES_*`. |
| `CORS_ORIGIN` | `http://localhost:8080` (the Vite dev server). |
| `OPEN_METEO_BASE_URL` | Keep `https://api.open-meteo.com` for normal play. |

Keep `.env` on your machine; it is ignored by Git. Do not paste the password or
admin token into issues, screenshots, or chat. Also copy
`frontend/.env.example` to `frontend/.env.local` and set
`VITE_GOOGLE_MAPS_API_KEY` — see the repo root `README.md`.

## Start and confirm initialization

From the repository root:

```bash
docker compose config -q
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:3000/api/health   # use your BACKEND_HOST_PORT
docker compose logs backend --tail=80
docker compose exec -T postgres psql -U terraguessr -d terraguessr -Atc 'select count(*) from "Location";'
```

Wait for `postgres` and `backend` to show `healthy`. The health request
returns JSON with `"status":"ok"`. On a fresh database, the backend log shows
migrations and `Seeded 2000 land locations`; the SQL command prints `2000`. On
later starts, the seed can report that the existing pool was kept.

In a second terminal, start the frontend against that backend:

```bash
npm run dev --prefix frontend
```

Open <http://localhost:8080> in your browser; it proxies `/api` to
`http://localhost:<BACKEND_HOST_PORT>` automatically (3000 by default).

## Play checklist

| Action | Expected result |
| --- | --- |
| Open a fresh private browser window, choose **Easy**, and start | Round 1 shows the four required weather metrics and optional pressure/wind direction; “Sun & local time” expands to UV index, sunshine duration and local time. Missing optional values show as unavailable. |
| Select one list entry, then a different one | The selected entry changes. Submit reveals the actual location, distance, and score. |
| Advance through all five rounds | The result screen shows five results and a total score. |
| Start **Medium** | Both map and list selection are available. Switch between them and submit a guess. |
| Start **Hard** | The interactive map is available. Click two different points before submitting; the pin moves. |
| Open **How to play** | The tutorial explains weather, guessing, and scoring. |

For the challenge, finish a solo game in browser session A and click **Challenge
a friend**. Copy the share link. Add a score as Alice. Open that link in a
separate private window or browser profile (session B); it should start an
independent challenge round. Make a different guess, submit it, and add a score
as Bob. The leaderboard should show both names. Before B submits, the actual
location is hidden; after submission, both players see the same actual
location. The sessions must use separate browser storage.

## Optional: test a weather failure safely

The normal stack uses live weather. The isolated test stack uses a deterministic
weather service and its own PostgreSQL volume. It does not alter the normal
game database. This scenario was verified with the following port overrides:

```bash
TERRAGUESSR_TEST_POSTGRES_PORT=5437 TERRAGUESSR_TEST_BACKEND_PORT=3005 TERRAGUESSR_TEST_FRONTEND_PORT=8085 TERRAGUESSR_TEST_WEATHER_PORT=4005 docker compose -p terraguessr-weather-check -f docker-compose.test.yml up -d --build
curl -fsS http://localhost:3005/api/health
curl -fsS -X POST 'http://localhost:4005/__test__/fail-next?count=4' -o /dev/null
```

Open <http://localhost:8085> (the test stack includes its own frontend) and
start a new Easy game. The mock fails the first location's weather request and
all three retries. Round 1 should still load with complete weather because the
API selects another location. Check the mock counters with:

```bash
curl -fsS http://localhost:4005/__test__/stats
TERRAGUESSR_TEST_POSTGRES_PORT=5437 TERRAGUESSR_TEST_BACKEND_PORT=3005 TERRAGUESSR_TEST_FRONTEND_PORT=8085 TERRAGUESSR_TEST_WEATHER_PORT=4005 docker compose -p terraguessr-weather-check -f docker-compose.test.yml stop
```

`failuresServed` should have increased by four. Stopping preserves its volume.

## Logs, stop, and restart

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 postgres
docker compose stop
docker compose start
docker compose ps
```

`docker compose stop` keeps the database volume and game data. To rebuild after
a code update, use `docker compose up -d --build` again. Avoid `down --volumes`
or `docker volume rm` unless you intentionally want to erase local data.

## If something does not load

- Check `docker compose ps` and `docker compose logs backend --tail=100`.
- If a port is already in use, change `POSTGRES_PORT` or `BACKEND_HOST_PORT`
  in `.env`, then rebuild. Keep `PORT=3000` because that's the internal
  container port. Vite reads `BACKEND_HOST_PORT` from the root `.env`, so the
  `/api` proxy updates automatically; keep `CORS_ORIGIN` at
  `http://localhost:8080`.
- If the database is healthy but a game cannot start, inspect backend logs
  for migration or seed errors; verify the `Location` count above.
- If weather does not appear, check outbound internet access to Open-Meteo.
  If the map is blank, check internet access to the configured tile server.
- After changing a `VITE_*` value, restart the frontend dev server (Vite only
  reads `.env.local` at startup).
