# Google Maps setup and diagnosis

## Current local status

The supplied credential is now configured in ignored `.env` and `frontend/.env.local` files with owner-only filesystem permissions. Its value is not committed, logged, or included in reports. The backend and Vite have been restarted with it.

Verified against Google's actual services on 19 November 2026:

- Official Street View metadata requests succeed from the backend.
- Maps JavaScript API loads in the browser and renders the guessing map and real Street View imagery.
- Camera rotation, street navigation, five consecutive rounds, geodesic scoring, final results, Play Again, and Return Home pass the live Playwright test.
- A separate mobile test passes touch selection, pin preservation through map collapse and browser refresh, and guess submission.

Open **http://localhost:8080/** and click **Play Solo**, or open **http://localhost:8080/game/singleplayer** directly. A round starts automatically when configuration is available. The live tests use the same URL and backend as the playable page.

## Original causes

Both `VITE_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_SERVER_API_KEY` were absent. The frontend returned before even checking the backend, so both missing dependencies appeared as generic unavailable placeholders. The backend returned `available: false`; no billing or authorization failure could be inferred without sending a credential.

Older Vite servers were also found pointing at backends without the new endpoints. Local development now uses one canonical origin, `http://localhost:8080`, and one backend port, 3000.

Vite also previously read its proxy override only from the launching shell. It now supports frontend/root Vite environment files, with shell values taking priority, and accepts the public browser key from either location. Server keys are never defined in Vite or copied to browser bundles.

Live verification found another substantive issue: nearest-image metadata can select an isolated contributor photosphere at a landmark. Such images rotate but cannot move along streets. The server now rejects those results using the returned Google attribution, selects another unused target, and bounds coverage lookup at twelve attempts. The browser also checks the real panorama's navigation links. If imagery has become disconnected or unavailable, **Try another location** replaces it within the same unscored round; it does not skip a round or award points.

## Configure a fresh installation

1. Select the intended project in [Google Cloud](https://console.cloud.google.com/).
2. Link an active [billing account](https://console.cloud.google.com/billing).
3. Enable [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com) and [Street View Static API](https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com). The latter is used only for supported metadata requests, not image downloads.
4. Create credentials in [Maps Platform credentials](https://console.cloud.google.com/google/maps-apis/credentials). Use **separate browser and server keys** for production:
   - Browser: restrict to **Maps JavaScript API** and HTTP website referrers, including `http://localhost:8080/*` and the exact deployed site origins.
   - Server: restrict to **Street View Static API** and the backend's public outbound IP addresses. Do not use a browser-referrer-restricted key on the server or fabricate a Referer header.
5. Set the server key in the application's root `.env`:

   ```dotenv
   GOOGLE_MAPS_SERVER_API_KEY=your_server_key
   ```

6. Set the browser key in `frontend/.env.local`:

   ```dotenv
   VITE_GOOGLE_MAPS_API_KEY=your_browser_key
   ```

   The Vite dev server proxies `/api` to `http://localhost:3000` by default.
   If you changed `BACKEND_HOST_PORT` in the root `.env`, that is picked up
   automatically; `VITE_DEV_API_PROXY_TARGET` is only an optional override.

7. Restart the backend and Vite. Rebuild frontend assets for production. Local commands are in [SINGLEPLAYER.md](SINGLEPLAYER.md).
8. Run `npm run maps:doctor`, then `npm run maps:verify` from the application repository.

For this local verification, the single supplied credential permits both services and is assigned to both local environment variables. Cloud Console restrictions have **not** been inspected or changed; this API key alone does not grant permission to administer that account. Splitting it into appropriately restricted credentials for deployment requires the project's owner. The application cannot set Cloud key restrictions through a Maps SDK request.

Google references: [browser key setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [credential security](https://developers.google.com/maps/api-security-best-practices), [metadata API](https://developers.google.com/maps/documentation/streetview/metadata), [Street View SDK](https://developers.google.com/maps/documentation/javascript/streetview).

## Diagnostic commands

```sh
npm run maps:doctor
npm run maps:verify
```

The doctor checks files without printing credentials, verifies the running backend through the frontend proxy, and makes a real metadata request if a server key is configured. It fails rather than reporting success when keys or the running service are missing. Its browser-key presence check does not itself claim authorization or image rendering; the live test verifies those.

The live test uses the real app, backend, database, Google SDK, tiles, and panoramas. It captures the screenshots and `live-game-report.json` in `docs/screenshots/playable/`. It does not intercept provider requests or substitute images. Set `PLAYWRIGHT_BASE_URL` if running elsewhere; that origin must be allowed on the browser key.

| Error | Action |
| --- | --- |
| `MISSING_SERVER_KEY` | Set the root server key and restart the backend |
| Browser key missing | Set the frontend public key, restart Vite/rebuild assets |
| Running backend lacks Street View endpoints | Start the backend and confirm `http://localhost:3000/api/health`; check `BACKEND_HOST_PORT` if you changed it |
| `PROVIDER_KEY_INVALID` / `InvalidKeyMapError` | Replace the invalid/expired credential |
| `PROVIDER_API_DISABLED` / `ApiNotActivatedMapError` | Enable the required API in the key's project and API restrictions |
| `PROVIDER_BILLING_DISABLED` / `BillingNotEnabledMapError` | Activate billing for that Cloud project |
| `RefererNotAllowedMapError` | Add the actual website origin to the browser key's allowed referrers |
| `PROVIDER_ACCESS_DENIED` | Check IP/API restrictions, key validity, and billing |
| `PROVIDER_QUOTA_EXCEEDED` | Check project quotas and usage/billing limits before retrying |
| `PANORAMA_UNAVAILABLE` / no connected streets | Retry the view or replace the panorama in the current round |
| `PROVIDER_NETWORK_ERROR` | Restore backend access to Google and retry |
| Expired session | Start a new game; expired state is cleared automatically |

Google's [error reference](https://developers.google.com/maps/documentation/javascript/error-messages) explains the browser error codes. The browser console retains original Google diagnostics. Server responses classify provider errors without exposing the key or raw provider error text.

## Usage costs and quotas

As published on 19 November 2026, Google's global pricing lists Dynamic Maps at **$7 per 1,000** after its **10,000 monthly free events**, and Dynamic Street View at **$14 per 1,000** after **5,000 monthly free events**. Street View Metadata has no listed usage charge. Billing is still required. Prices and allowances vary with region, volume, and agreements; see the [current pricing table](https://developers.google.com/maps/billing-and-pricing/pricing).

From this implementation's constructor counts, a normal fresh five-round game creates approximately twelve map instances and five panorama instances: an estimated **$0.154 per game** at those first-tier rates after free usage is exhausted, before taxes. Reloads, retries, additional games, and previews can add loads. This is an implementation estimate, not a measurement of the user's bill. Panning/zooming an existing map does not recreate its constructor; changing whether a guess can be edited no longer recreates the map.

Google lists map-load quotas of **30,000/minute per project** and **300/minute per IP**. Review the account's actual [quotas](https://console.cloud.google.com/google/maps-apis/quotas) and [billing/usage rules](https://developers.google.com/maps/documentation/javascript/usage-and-billing); account-specific limits may differ. The application also limits owned game operations to thirty requests per route per minute.

All images and maps are served through official Google APIs with attribution intact. No scraped imagery, fake provider responses, hidden public keys masquerading as private secrets, or committed credentials are used.
