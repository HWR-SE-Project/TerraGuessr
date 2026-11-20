# TerraGuessr Street View singleplayer

Local page: **http://localhost:8080/game/singleplayer**

Current gameplay reliability checkpoint: `26d08d6` (original implementation checkpoint: `fe35d43`). Nothing was pushed. The approved Home layout is unchanged: only its Solo card and Singleplayer link destinations changed. Auth, Duels, daily challenges, and the original weather game at `/play` remain separate.

Real Google Street View and map gameplay are now configured and verified end to end. See [current setup and diagnosis](GOOGLE_MAPS_SETUP.md) and [verification](VERIFICATION.md).

## Implemented

- Full viewport, interactive Google Street View with drag rotation, street navigation, zoom, optional compass, and face-north control. Google attribution and reporting controls remain intact.
- Translucent corner controls, unobtrusive round/score/status HUD, Return button, and confirmation before leaving an expedition or restarting.
- Independent world guessing map with pan/zoom, click/tap placement, draggable pin, collapse, click expansion, desktop hover expansion, and a larger touch map. It starts at a neutral world position and never follows the panorama.
- Persistent local display settings: hover expansion, compass, scroll-wheel panorama zoom, and map opacity. Native modal dialogs trap focus, support Escape, and restore focus to their trigger.
- Five untimed rounds, server-validated guesses, geodesic result lines, per-round distances/scores, final overview, expandable round coordinates, restart, and return home.
- Tab-local resume for 24 hours, including after a lost guess response. Session credentials use their own sessionStorage key and never replace weather/duel player tokens.
- Loading, ready, exploring, selected, submitting, round results, next-round loading, completed, provider unavailable, and error states. Failed provider requests never produce an invented round or score.

## Required API configuration

Two environment entries are required; use **separate restricted keys for deployment**. The supplied local credential currently works for both services. See [current setup](GOOGLE_MAPS_SETUP.md). OAuth client credentials are unrelated and are not reused.

1. In the root `.env`, set `GOOGLE_MAPS_SERVER_API_KEY`. Enable **Street View Static API** on its Google Cloud project. Restrict this key to that API and the backend's outbound IP addresses. It is used only by the backend for official metadata requests, never for downloading images. Do not put it in any `VITE_*` variable.
2. Copy `frontend/.env.example` to `frontend/.env.local`. Set `VITE_GOOGLE_MAPS_API_KEY`. Enable **Maps JavaScript API**, configure billing, restrict this browser key to that API and exact HTTP referrers such as `http://localhost:8080/*` and the production origin. Browser keys are intentionally public; the operator must apply restrictions in Google Cloud. Application code cannot set those restrictions.
3. Review the enabled services' billing, quotas, and applicable Google terms before turning on live traffic. Config availability means keys exist, not that billing/authorization has been successfully checked. Actual calls handle denied requests, timeouts, and unavailable coverage.
4. Restart the backend and Vite after configuration changes. For production, rebuild the frontend with the browser key present. Both regular and production Compose files forward the server key; they do not expose it to frontend assets.

References: [browser key configuration](https://developers.google.com/maps/documentation/javascript/get-api-key), [API security](https://developers.google.com/maps/api-security-best-practices), [Street View metadata](https://developers.google.com/maps/documentation/streetview/metadata), [Street View controls](https://developers.google.com/maps/documentation/javascript/reference/street-view), [Maps JavaScript policies](https://developers.google.com/maps/documentation/javascript/policies), [Street View Static policies](https://developers.google.com/maps/documentation/streetview/policies).

## Run locally

Follow the repo root `README.md` quick start. In short:

```sh
docker compose up --build -d      # postgres + backend + Mailpit
npm run dev --prefix frontend     # http://localhost:8080
```

The Vite dev server proxies `/api` to `http://localhost:<BACKEND_HOST_PORT>`
(3000 by default), which it reads from the root `.env`. Do not start a second
frontend on another port or a second backend on another host: all local
development uses `http://localhost:8080` for the app and
`http://localhost:3000` for the API.

On installations without keys, the page reports exactly which configuration is
missing and disables guessing.

## API and scoring

New, isolated endpoints:

| Request | Purpose |
| --- | --- |
| `GET /api/singleplayer/config` | Server provider configuration availability; no keys returned |
| `POST /api/singleplayer/games` | Create a five-round session; return an opaque player token once |
| `GET /api/singleplayer/games/:gameId` | Resume active round and retrieve completed results/total |
| `POST /api/singleplayer/games/:gameId/rounds` | Start next round, or return the existing active round on retry |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/retry` | Replace unavailable imagery in the same unscored round |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/guess` | Submit `{lat, lon}` and receive the locked result |

Owned requests require `X-Player-Token`; only its SHA-256 hash is stored. Wrong/missing tokens and expired sessions return 404. Session/round/result responses carry `Cache-Control: no-store`. Resource creation, round creation, reads, and scoring are rate limited. Sessions expire after 24 hours; expired sessions are lazily removed on new session creation, cascading their rounds.

Locations come from 30 independently authored worldwide road targets. Each round randomly tries up to twelve unused targets against Google's live outdoor coverage, accepting a panorama only within 50 m of the target. Repeated target indices are excluded within an expedition. This is a bounded curated pool, not unrestricted random worldwide sampling.

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

See the [current verification report](VERIFICATION.md). A full real-provider game and mobile touch/refresh/submission tests passed on 19 November 2026. These are actual Google Maps/Street View captures:

- [Active desktop gameplay](../screenshots/playable/active-desktop.png)
- [Active mobile gameplay](../screenshots/playable/active-mobile.png)
- [Expanded guessing map](../screenshots/playable/expanded-map.png)
- [Round results](../screenshots/playable/round-results.png)
- [Final results](../screenshots/playable/final-results.png)
- [Mobile round results](../screenshots/playable/mobile-round-results.png)
- [Actual five-round API results and test report](../screenshots/playable/live-game-report.json)

The previous `screenshots/singleplayer/` directory is retained as historical evidence of the original unavailable implementation and explicitly labelled component fixtures. It is superseded by the real gameplay captures above.

Run `npm run maps:doctor` to check the configuration, and `npm run maps:verify` to run the live Google tests and regenerate the actual screenshots. The live command makes real provider requests and may consume the account's paid usage allowance. The separate missing-credential suite should run against a test server with the keys explicitly unset, not against the configured playable instance.

Remaining constraints: thirty curated road search targets, 24-hour tab-local sessions, no ranked anti-cheat or integration into legacy account weather statistics, and no physical-device coverage beyond Chromium touch emulation. Deployment key restrictions require the Google Cloud project owner; see [setup](GOOGLE_MAPS_SETUP.md). No reference image was attached to the received task, so exact pixel comparison remains unavailable.
