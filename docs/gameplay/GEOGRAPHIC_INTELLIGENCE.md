# Geographic Intelligence

Implemented on the Street View singleplayer screen, without replacing its HUD, guess map, or navigation. The 280 px desktop panel sits below the brand with a separate gutter for Google's existing zoom controls. The collapsed state aligns with the logo and Return button; both desktop states sit 18 px below the brand. It has a compact collapsed state, subtle entrance/collapse transitions, a humidity meter, wind direction indicator, and restrained geographic icons. On phones, a 44 px floating control opens a scrollable native modal bottom sheet. Escape, keyboard focus containment/restoration, and reduced motion are supported.

## Available metrics

| Attribute | Source / interpretation |
| --- | --- |
| Temperature (°C), conditions | Open-Meteo `current` weather model, WMO condition codes mapped to a fixed vocabulary |
| Wind (km/h), direction | Model at 10 m; compass label indicates where wind comes from; arrow indicates flow |
| Relative humidity (%) | Model at 2 m; a compact meter accompanies the number |
| Surface pressure (hPa) | Pressure at the modeled surface, not sea-level pressure |
| Precipitation (mm) | Model accumulation; the provider's interval is shown (usually 15 minutes) |
| Elevation (m) | Open-Meteo elevation API, Copernicus DEM GLO-90 (90 m surface model) |
| Terrain relief estimate | Peak-to-peak height variation among nine elevation samples across approximately 2 km: low <50 m, rolling 50–199 m, high ≥200 m |

Terrain is a sampled relief proxy, **not a landform classification**. A digital surface model can include buildings and vegetation. The interface marks the estimate and provides keyboard-accessible data notes. Near the poles, the relief estimate is omitted because the sampling geometry is unreliable.

**Unavailable:** biome, vegetation, ecological zone, descriptive landscape classification, climate classification, typical temperature range, and average annual precipitation. No verified datasets for those attributes are connected. The expandable climate section explains this; no labels or averages are inferred from current weather, country, latitude, or elevation.

## Provider provenance and configuration

- [Open-Meteo weather documentation](https://open-meteo.com/en/docs): current conditions are weather model estimates, not measurements from a local station.
- [Open-Meteo elevation documentation](https://open-meteo.com/en/docs/elevation-api): Copernicus DEM 2021 GLO-90.
- Provider and Copernicus attribution links, plus the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) link, appear in the panel.
- UTC model timestamps are shown, with a distinct “Cached model” label for a server-cache hit. The panel explains that imagery can be older than the weather. Data is never labeled live.
- Existing `OPEN_METEO_BASE_URL` is respected. No new key is needed for non-commercial evaluation. For commercial use, configure `OPEN_METEO_BASE_URL=https://customer-api.open-meteo.com` and the server-only `OPEN_METEO_API_KEY`, following [Open-Meteo's commercial terms](https://open-meteo.com/en/pricing). Both Compose deployments forward the optional key; the older weather client also supports it so that changing this shared provider configuration preserves other game modes.
- Existing `GOOGLE_MAPS_SERVER_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` are still needed for Street View. No migration is required. Restart the backend when changing provider configuration.

## Privacy boundary and lifecycle

`GET /api/singleplayer/games/:gameId/rounds/:roundId/intelligence` requires the owning `X-Player-Token`, an unexpired game, and an unscored round belonging to that game. It resolves the **starting panorama** server-side, never a client-supplied location or the camera's navigated position. The browser makes no weather/elevation provider requests.

The provider adapter constructs a fresh result from numeric values, UTC timestamps, and a fixed condition/relief vocabulary. Fastify additionally serializes through an explicit response schema at every level. Coordinates, country, city, region, timezone names, addresses, provider URLs, and raw payloads/errors are absent from this endpoint. HTTP responses use `private, no-store`. Rate limiting uses the game's existing 30 requests/minute policy. The round is checked again after provider retrieval so a replaced or scored round cannot publish an obsolete response.

This protects the new environmental API. The existing Google Street View SDK still requires a panorama ID and handles Google's panorama metadata as before; it is not a secure anti-cheat boundary against inspection of the Google SDK itself.

Provider requests run in parallel with a six-second timeout, per-coordinate request deduplication, and bounded process-local caches (512 entries each). Weather expires after 15 minutes, elevation after 30 days; unsuccessful retrievals have a 30-second retry backoff. Expired weather is not served as fresh. Instances maintain independent caches. Partial data remains useful when one provider fails, and unknown measurements render as unavailable rather than zero. No Google panorama coordinates or raw provider payloads are persisted by this feature.

Data loads independently of Street View readiness and never blocks guessing. Requests are aborted/discarded on teardown. New rounds and replacement panoramas remount the panel and reset its UI/data; results, completed games, and leaving gameplay remove it. Camera movement does not request new environmental data.

## Verification

Local app: `http://localhost:8080/game/singleplayer` (Vite frontend, backend on port 3000).

- Frontend unit/component tests: **49 passed**, including zero values, loading, retry, unavailable data, inert collapse, request cancellation, and late-response rejection.
- Backend unit tests: **179 passed**, including six new tests for provider sanitization/validation, cache expiration/deduplication, partial failures, ownership, expiry, scored/foreign rounds, response allowlisting, and round-replacement races. Commercial key compatibility is also tested.
- Real PostgreSQL singleplayer integration: **9 passed**, using a separate disposable database and explicit Google provider doubles; test database removed afterward.
- Live Google desktop five-round game and live mobile touch/guess tests: **2 passed**. Covers navigation, real map selection, scoring, round/final results, restart, Home, refresh, and retained guess pins.
- Browser panel/Home/Auth/Duels/navigation suite: **16 passed**. Uses real Google imagery and real Open-Meteo weather/elevation for the panel, with no substitute imagery or seeded environmental values. Covers collapse/expand, climate disclosure, camera/Street View navigation, endpoint field checks, mobile bottom sheet, focus cycling/restoration, Escape, reduced motion, and absence of browser errors. The final panel run also verifies reset after scoring, fresh clues for the next round, and widths from 320 to 1792 px.
- Production frontend build and backend typecheck pass. Targeted backend ESLint passes. Frontend lint has only existing warnings in unrelated files; the build retains its existing large-chunk warning.

Screenshots were visually reviewed at the existing gameplay reference viewport, **1792×861**, and mobile **390×844**:

- [Desktop expanded](../screenshots/intelligence/desktop-expanded.png)
- [Desktop collapsed](../screenshots/intelligence/desktop-collapsed.png)
- [Mobile sheet](../screenshots/intelligence/mobile-expanded.png)
- [Mobile floating control](../screenshots/intelligence/mobile-collapsed.png)
- [Machine-readable browser verification](../screenshots/intelligence/verification.json)

Run the live panel checks with:

```sh
TERRAGUESSR_LIVE_MAPS=1 PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test e2e/intelligence.live.spec.ts
```
