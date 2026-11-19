# TerraGuessr Street View singleplayer

Local page: **http://127.0.0.1:5173/game/singleplayer**

Implementation checkpoint: `fe35d43`. Nothing was pushed. The approved Home layout is unchanged: only its Solo card and Singleplayer link destinations changed. Auth, Duels, daily challenges, and the original weather game at `/play` remain separate.

## Implemented

- Full viewport, interactive Google Street View with drag rotation, street navigation, zoom, optional compass, and face-north control. Google attribution and reporting controls remain intact.
- Translucent corner controls, unobtrusive round/score/status HUD, Return button, and confirmation before leaving an expedition or restarting.
- Independent world guessing map with pan/zoom, click/tap placement, draggable pin, collapse, click expansion, desktop hover expansion, and a larger touch map. It starts at a neutral world position and never follows the panorama.
- Persistent local display settings: hover expansion, compass, scroll-wheel panorama zoom, and map opacity. Native modal dialogs trap focus, support Escape, and restore focus to their trigger.
- Five untimed rounds, server-validated guesses, geodesic result lines, per-round distances/scores, final overview, expandable round coordinates, restart, and return home.
- Tab-local resume for 24 hours, including after a lost guess response. Session credentials use their own sessionStorage key and never replace weather/duel player tokens.
- Loading, ready, exploring, selected, submitting, round results, next-round loading, completed, provider unavailable, and error states. Failed provider requests never produce an invented round or score.

## Required API configuration

Two **different** keys are required. OAuth client credentials are unrelated and are not reused.

1. In the root `.env`, set `GOOGLE_MAPS_SERVER_API_KEY`. Enable **Street View Static API** on its Google Cloud project. Restrict this key to that API and the backend's outbound IP addresses. It is used only by the backend for official metadata requests, never for downloading images. Do not put it in any `VITE_*` variable.
2. Copy `frontend/.env.example` to `frontend/.env.local`. Set `VITE_GOOGLE_MAPS_API_KEY`. Enable **Maps JavaScript API**, configure billing, restrict this browser key to that API and exact HTTP referrers such as `http://127.0.0.1:5173/*`, `http://localhost:5173/*`, and the production origin. Browser keys are intentionally public; the operator must apply restrictions in Google Cloud. Application code cannot set those restrictions.
3. Review the enabled services' billing, quotas, and applicable Google terms before turning on live traffic. Config availability means keys exist, not that billing/authorization has been successfully checked. Actual calls handle denied requests, timeouts, and unavailable coverage.
4. Restart the backend and Vite after configuration changes. For production, rebuild the frontend with the browser key present. Both regular and production Compose files forward the server key; they do not expose it to frontend assets.

References: [browser key configuration](https://developers.google.com/maps/documentation/javascript/get-api-key), [API security](https://developers.google.com/maps/api-security-best-practices), [Street View metadata](https://developers.google.com/maps/documentation/streetview/metadata), [Street View controls](https://developers.google.com/maps/documentation/javascript/reference/street-view), [Maps JavaScript policies](https://developers.google.com/maps/documentation/javascript/policies), [Street View Static policies](https://developers.google.com/maps/documentation/streetview/policies).

## Run locally

From the application repository, `v1.0.0-initial-commit/`:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npx --prefix backend prisma generate --schema backend/prisma/schema.prisma
npx --prefix backend prisma migrate deploy --schema backend/prisma/schema.prisma
```

The existing PostgreSQL configuration in the root `.env` is required. The additive migration creates only `StreetGame` and `StreetRound` and leaves existing tables/contracts unchanged. It has been applied to the local development database.

Start the backend in one terminal (3005 avoids this workspace's existing Docker backend):

```sh
cd backend
PORT=3005 node --env-file=../.env --import tsx src/server.ts
```

Start the frontend from the application repository in another:

```sh
VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3005 npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173
```

Vite proxies `/api` without rewriting Host, preserving existing same-site authentication behavior. The public URL above is already running in this workspace. Without the two Maps keys, it shows the actual unavailable state and disables guessing.

## API and scoring

New, isolated endpoints:

| Request | Purpose |
| --- | --- |
| `GET /api/singleplayer/config` | Server provider configuration availability; no keys returned |
| `POST /api/singleplayer/games` | Create a five-round session; return an opaque player token once |
| `GET /api/singleplayer/games/:gameId` | Resume active round and retrieve completed results/total |
| `POST /api/singleplayer/games/:gameId/rounds` | Start next round, or return the existing active round on retry |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/guess` | Submit `{lat, lon}` and receive the locked result |

Owned requests require `X-Player-Token`; only its SHA-256 hash is stored. Wrong/missing tokens and expired sessions return 404. Session/round/result responses carry `Cache-Control: no-store`. Resource creation, round creation, reads, and scoring are rate limited. Sessions expire after 24 hours; expired sessions are lazily removed on new session creation, cascading their rounds.

Locations come from 30 independently authored worldwide road targets. Each round randomly tries up to six unused targets against Google's live outdoor coverage, accepting a panorama only within 50 m of the target. Repeated target indices are excluded within an expedition. This is a bounded curated pool, not unrestricted random worldwide sampling.

The response before guessing contains **only round ID, round number, and panorama ID**. Neither target nor actual coordinates are sent. The server resolves the **exact original panorama position live when scoring**, rather than scoring against the nearby authored search target. Player navigation does not change the round answer.

Distance reuses `backend/src/domain/distance.ts`: Haversine with mean Earth radius **6371.0088 km**. Score reuses `backend/src/domain/scoring.ts`:

```text
points = round(clamp(5000 × exp(-distanceKm / 2000), 0, 5000))
maximum total = 5 × 5000 = 25,000
```

An atomic conditional database update locks each guess. Identical submissions return the same persisted score; a different guess after locking returns 409. Next-round creation has a unique `(gameId, number)` constraint and recovers concurrent duplicate requests. Client-supplied scores cannot influence calculation.

No imagery, provider coordinates, addresses, or other metadata are stored. Only panorama IDs (permitted identifiers), independently authored search targets, user guesses, scores, and distances are persisted. Actual coordinates for restored results are resolved live again, so restored result maps depend on provider availability. SDK imagery is served and attributed by Google directly.

This is singleplayer only. The API avoids sending answer coordinates early, but an interactive browser SDK inherently exposes panorama metadata to a determined user with developer tools. This is not an anti-cheat system and does not establish a competitive/ranked contract. Existing Duels APIs remain untouched.

## Verification and screenshots

See [verification report](VERIFICATION.md) for exact test results and known existing failures.

The referenced image was not present in the received conversation. The implementation follows the brief's corner composition; pixel comparison against the absent reference cannot be claimed. Desktop captures use 1792×861, and phone captures use 390×844. A browser geometry report also checks 320×640, 768×1024, 1024×768, 1280×800, and 844×390, with no horizontal overflow or compact-control overlap.

- [Desktop, actual unavailable state](../screenshots/singleplayer/desktop-unavailable-1792x861.png)
- [Mobile, actual unavailable state](../screenshots/singleplayer/mobile-unavailable-390x844.png)
- [Expanded map, actual unavailable state](../screenshots/singleplayer/expanded-map-unavailable.png)
- [Mobile expanded map, actual unavailable state](../screenshots/singleplayer/mobile-expanded-map-unavailable.png)
- [Settings](../screenshots/singleplayer/settings.png)
- [Round results, labelled component fixture](../screenshots/singleplayer/round-results-component-fixture.png)
- [Final results, labelled component fixture](../screenshots/singleplayer/final-results-component-fixture.png)
- [Home regression capture](../screenshots/singleplayer/home-regression.png)
- [Browser errors and geometry](../screenshots/singleplayer/browser-results.json)

Result captures use **isolated, explicitly labelled visual fixtures** to inspect result components without provider credentials. They are not live games, their coordinates and scores are illustrative, and they are never available in the production gameplay path. No Street View image or successful live API response was fabricated.

Reproduce screenshots against the Vite development server:

```sh
node docs/screenshots/singleplayer/capture.mjs
```

After configuring real keys, run the opt-in live test to verify actual rotation, map selection, five-round scoring, final results, restart, and leaving:

```sh
TERRAGUESSR_LIVE_MAPS=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 \
  npx playwright test e2e/singleplayer.spec.ts --grep 'live provider'
```

The unavailable-state tests assume keys are absent. The live test is skipped by default and makes real provider requests when enabled. Street navigation links, imagery rendering, live map tiles, touch gestures on physical devices, and screenshots of a genuine completed expedition still require the configured provider and an actual reference image for the requested visual comparison. New singleplayer results are tab-local, expire after 24 hours, and are not added to existing account weather-game statistics.
