# TerraGuessr Street View singleplayer

Local page: **http://localhost:8080/game/singleplayer**

Current gameplay reliability checkpoint: `26d08d6` (original implementation checkpoint: `fe35d43`). Nothing was pushed. The approved Home layout is unchanged: only its Solo card and Singleplayer link destinations changed. Authentication remains a separate account flow.

Real Google Street View and map gameplay are now configured and verified end to end. See [current setup and diagnosis](GOOGLE_MAPS_SETUP.md) and [verification](VERIFICATION.md).

## Implemented

- Full viewport, interactive Google Street View with drag rotation, street navigation, zoom, optional compass, and face-north control. Google attribution and reporting controls remain intact.
- Translucent corner controls, unobtrusive round/score/status HUD, Return button, and confirmation before leaving an expedition or restarting.
- Independent world guessing map with pan/zoom, click/tap placement, draggable pin, collapse, click expansion, desktop hover expansion, and a larger touch map. It starts at a neutral world position and never follows the panorama.
- Persistent local display settings: hover expansion, compass, scroll-wheel panorama zoom, and map opacity. Native modal dialogs trap focus, support Escape, and restore focus to their trigger.
- Five untimed rounds, server-validated guesses, geodesic result lines, per-round distances/scores, final overview, expandable round coordinates, restart, and return home.
- **Three difficulty levels (R05)**, chosen before starting and persisted per browser (`terraguessr.difficulty.v1`): Easy guesses from a 6-option named-city list instead of the map and starts with Geographic Intelligence expanded; Medium is today's free map placement, expanded panel; Hard is free map placement with the panel starting collapsed (still fully available on demand — never fewer clues, just not shown by default). Difficulty is fixed for the life of a game and returned on the session.
- **List-mode guessing (R07)**, easy difficulty only: the round response includes `candidates`, the actual target plus five distractors drawn from the unused location pool, labeled with real city names and shuffled so the answer's position never leaks which one is correct. Selecting an option submits through the exact same `/guess` endpoint as a map click.
- **Mandatory weather validation gate (R03) with automatic fallback (R13)**: a candidate location is only accepted once Open-Meteo returns all four mandatory fields (temperature, precipitation, humidity, wind speed) for it. A location that fails is excluded and another is tried automatically (bounded attempts, never an infinite loop); if every attempt fails, the round surfaces a recoverable `WEATHER_UNAVAILABLE` 503 with a Retry affordance — the UI never starts a round with missing mandatory data.
- **Next-round prefetch (R12)**: after a guess locks, the backend best-effort selects and weather-validates the following round's location in the background and caches it on the game row. The next `rounds` call consumes that cache atomically (and clears it, so two concurrent requests can't double-consume it) instead of making a fresh provider/weather round trip — a failed or slow prefetch is invisible to the player, who just gets the normal synchronous path.
- **Tutorial (R14)**: a five-step walkthrough (weather, location, confirmation, distance, scoring) with an in-card practice location list and a try-out guess submission, plus an interactive score slider. It auto-opens for every new game and is replayable from the home entry or the in-game "How to play" button; Exit and Restart are available at every step.
- **Durable result archive with 6-month retention (R18)**: every locked guess is archived (`StreetResult`: actual + guess coordinates, distance, score, difficulty, timestamp) independently of the 24h session, and purged by its own daily retention job — so results outlive the resumable session without the session itself being kept indefinitely.
- Tab-local resume for 24 hours, including after a lost guess response. Session credentials use their own sessionStorage key and never replace other player tokens.
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
| `POST /api/singleplayer/games` | Create an endless session with an optional `{ difficulty }` body (`easy`\|`medium`\|`hard`, default `medium`); return an opaque player token once |
| `GET /api/singleplayer/games/:gameId` | Resume active round and retrieve completed results/total/difficulty |
| `POST /api/singleplayer/games/:gameId/rounds` | Start next round (weather-validated, prefetch-aware), or return the existing active round on retry |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/retry` | Replace unavailable imagery or missing-weather locations in the same unscored round |
| `PUT /api/singleplayer/games/:gameId/rounds/:roundId/selection` | Persist the latest pin so a timeout can evaluate it (R08) |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/unlock` | Unlock additional data using the shared difficulty policy (free / −100 points / −20 seconds) |
| `POST /api/singleplayer/games/:gameId/rounds/:roundId/guess` | Submit `{lat, lon, final?}`; non-final attempts return attempts remaining, while a final/exhausted attempt locks the round, archives it, and prefetches the next round |

Owned requests require `X-Player-Token`; only its SHA-256 hash is stored. Wrong/missing tokens and expired sessions return 404. Session/round/result responses carry `Cache-Control: no-store`. Resource creation, round creation, reads, and scoring are rate limited. Sessions expire after 24 hours; expired sessions are lazily removed on new session creation, cascading their rounds — the archived `StreetResult` rows (see Retention below) are unaffected by this cascade.

Locations come from 30 independently authored worldwide road targets. Each round randomly tries up to twelve unused targets against Google's live outdoor coverage, accepting a panorama only within 50 m of the target, **then validates Open-Meteo weather data for that same target (R03)** before accepting it — a target that fails either coverage or weather is excluded and another is tried, bounded by both the pool size and an explicit attempt ceiling (R13). Repeated target indices are excluded within an expedition. This is a bounded curated pool, not unrestricted random worldwide sampling, and (being real city roads) is land by construction — verified by a regression test against the same Natural Earth land-mask data the legacy weather game's location pool uses (R02).

The response before guessing contains the **round ID, round number, panorama ID, timer, attempt budget and extra-data access state**. Neither target nor actual coordinates are sent. The server resolves the **exact original panorama position live when scoring**, rather than scoring against the nearby authored search target. Player navigation does not change the round answer.

Distance reuses `backend/src/domain/distance.ts`: Haversine with mean Earth radius **6371.0088 km**. Score reuses `backend/src/domain/scoring.ts`:

```text
points = floor(5000 × (20000 − distanceKm) / 19900), applied to the R9-rounded distance
          5000 for distanceKm ≤ 100 · 0 for distanceKm ≥ 20000
endless mode has no fixed total cap
```

Round rules are shared with multiplayer in `domain/gameRules.ts` and `domain/roundFlow.ts`: Easy 7 min / 3 attempts / 6-location list, Medium 4 min / 2 attempts, Hard 2 min / 1 attempt, all with country borders on the map. Each accepted guess creates a `StreetRoundAttempt`; only final submission or the last available attempt locks/evaluates the round. Identical submissions return the same persisted result; a different guess after locking returns 409. Next-round creation has a unique `(gameId, number)` constraint and recovers concurrent duplicate requests. Client-supplied scores cannot influence calculation.

No imagery, provider coordinates, addresses, or other metadata are stored. Only panorama IDs (permitted identifiers), independently authored search targets, user guesses, scores, and distances are persisted. Actual coordinates for restored results are resolved live again, so restored result maps depend on provider availability. SDK imagery is served and attributed by Google directly.

**Retention (R18):** when a round finalizes, the backend writes one `StreetResult` row (game/round id, difficulty, actual + guess coordinates, distance, score, timestamp) in addition to updating the live `StreetRound`. `StreetResult` has no relation to `StreetGame`/`StreetRound`, so it survives the 24h session-expiry cleanup untouched. A daily job (`backend/src/scheduler/purge.ts`'s `purgeExpiredStreetResults`, alongside the existing weather-game purge) deletes `StreetResult` rows older than the shared 6-month retention window (`PURGE_RETENTION_MS`).

This is singleplayer only. The API avoids sending answer coordinates early, but an interactive browser SDK inherently exposes panorama metadata to a determined user with developer tools. This is not an anti-cheat system and does not establish a competitive/ranked contract. Legacy weather-game and duel APIs have been removed.

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
