# TerraGuessr: manual testing on macOS

This guide runs the local application from `main`. It uses Docker Compose for
PostgreSQL, the API, and the browser UI. No manual migration or database seed is
needed. The application calls Open-Meteo for live weather and OpenStreetMap for
map tiles, so internet access is needed for normal play.

## Before you start

- Install Git and Docker Desktop for Mac. Start Docker Desktop and wait until
  `docker compose version` works in Terminal.
- Have a modern browser (Chrome or Safari) and enough disk space for Docker
  images. You do not need Node.js for normal manual play.
- Ports 8080 (browser), your chosen API host port, and your chosen PostgreSQL
  host port must be free. This project was verified with `BACKEND_HOST_PORT=3004`
  and `POSTGRES_PORT=5436` because other local services occupied 3000 and
  5432. The API still listens on port 3000 *inside* the Compose network.

## Get the code and configure it

For a new checkout:

```bash
git clone https://github.com/HWR-SE-Project/v1.0.0-initial-commit.git
cd v1.0.0-initial-commit
git switch main
cp .env.example .env
chmod 600 .env
open -e .env
```

For an existing checkout, run `git switch main` and `git pull --ff-only origin
main`, then keep your existing `.env`. Do not overwrite it with the example.

In the editor, set these values in `.env` before starting:

| Variable | What to set |
| --- | --- |
| `POSTGRES_PASSWORD` | A new, long, URL-safe random password. Replace the example value. |
| `ADMIN_API_TOKEN` | A different, long, random token. Replace the example placeholder. |
| `POSTGRES_PORT` | `5436` on the verified Mac setup, or `5432` if free. |
| `BACKEND_HOST_PORT` | `3004` on the verified Mac setup, or `3000` if free. Keep `PORT=3000` internally. |
| `DATABASE_URL` | If running backend tools directly on your Mac, use the same password and host port. Compose derives its own internal URL from `POSTGRES_*`. |
| `FRONTEND_PORT`, `PORT`, `CORS_ORIGIN` | Keep `8080`, `3000`, `http://localhost:8080` for the URLs below. |
| `VITE_API_BASE_URL` | Keep `/api`. |
| `OPEN_METEO_BASE_URL` | Keep `https://api.open-meteo.com` for normal play. |

Keep `.env` on your machine; it is ignored by Git. Do not paste the password or
admin token into issues, screenshots, or chat.

## Start and confirm initialization

From the repository root:

```bash
docker compose config -q
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/api/health
docker compose logs backend --tail=80
docker compose exec -T postgres psql -U terraguessr -d terraguessr -Atc 'select count(*) from "Location";'
```

Wait for `postgres`, `backend`, and `frontend` to show `healthy`. The health
request returns JSON with `"status":"ok"`. On a fresh database, the backend
log shows migrations and `Seeded 2000 land locations`; the SQL command prints
`2000`. On later starts, the seed can report that the existing pool was kept.

Open **http://localhost:8080** in your browser. The backend is also reachable
at `http://localhost:3004/api/health` with the tested host port (or 3000 if
`BACKEND_HOST_PORT=3000`); the browser normally uses `/api` through
the frontend proxy.

## Play checklist

| Action | Expected result |
| --- | --- |
| Open a fresh private browser window, choose **Easy**, and start | Round 1 shows four weather fields and a location list. |
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
curl -fsS http://localhost:8085/api/health
curl -fsS -X POST 'http://localhost:4005/__test__/fail-next?count=4' -o /dev/null
```

Now open **http://localhost:8085** and start a new Easy game. The mock fails
the first location's weather request and all three retries. Round 1 should
still load with complete weather because the API selects another location.
Check the mock counters with:

```bash
curl -fsS http://localhost:4005/__test__/stats
TERRAGUESSR_TEST_POSTGRES_PORT=5437 TERRAGUESSR_TEST_BACKEND_PORT=3005 TERRAGUESSR_TEST_FRONTEND_PORT=8085 TERRAGUESSR_TEST_WEATHER_PORT=4005 docker compose -p terraguessr-weather-check -f docker-compose.test.yml stop
```

`failuresServed` should have increased by four. Stopping preserves its volume.

## Logs, stop, and restart

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
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
- If a port is already in use, change `POSTGRES_PORT`, `FRONTEND_PORT`, or
  `BACKEND_HOST_PORT` in `.env`, then rebuild. Keep `PORT=3000` because the
  frontend proxy uses that internal port. When changing `FRONTEND_PORT`, also update
  `CORS_ORIGIN` to the new `http://localhost:<port>` value.
- If the database is healthy but a game cannot start, inspect backend logs
  for migration or seed errors; verify the `Location` count above.
- If weather does not appear, check outbound internet access to Open-Meteo.
  If the map is blank, check internet access to the configured tile server.
- After changing a `VITE_*` value, run `docker compose up -d --build frontend`
  because the frontend reads those values at build time.
