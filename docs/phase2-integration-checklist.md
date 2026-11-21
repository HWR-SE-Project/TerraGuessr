# Phase 2 — Backend Integration Checklist

The v2 frontend is complete and visually verified against mocks. Phase 2 wires it
to the untouched backend. The backend was **not** modified in Phase 1.

## The single swap point

`frontend/src/services/index.ts` is the only file that imports the mock layer.
Replace those re-exports with an HTTP implementation that keeps the exact method
names and `lib/contracts.ts` types. Pages and state stores already call through
`api`, so they should not change.

```ts
// services/index.ts (Phase 2)
import { authHttp } from './http/auth'
import { singleplayerHttp } from './http/singleplayer'
import { lobbyHttp } from './http/lobbies'
import { geoHttp } from './http/geo'
export const api = { auth: authHttp, singleplayer: singleplayerHttp, lobby: lobbyHttp, geo: geoHttp }
```

## What to build in `services/http/`

1. **Client.** Re-implement the fetch wrapper (the old `src/api/client.ts` is the
   reference): JSON in/out, `credentials: 'include'`, `X-Player-Token` and
   `X-Lobby-Token` headers, `ApiError` from the backend's error envelope.
2. **Auth** → `backend/src/modules/auth/routes.ts`. Map each mock method to its
   route (`/auth/session`, `/auth/register`, `/auth/login`, `/auth/logout`,
   `/auth/verify-email`, `/auth/verification/resend`, `/auth/password-reset/*`,
   `/auth/email-change/*`, `/auth/profile`, `/auth/preferences`, `/auth/avatar`,
   `/auth/account`, `/auth/config`).
3. **Singleplayer** → `backend/src/modules/singleplayer/routes.ts`. Note the token
   is stored in `localStorage` under `terraguessr.playerToken` in the old client;
   reuse `state/game.ts` to hold the returned credentials.
4. **Lobbies** → `backend/src/modules/lobbies/routes.ts`. Replace the mock's
   polling with the real match polling (`/lobbies/:code/match`); the round-result
   "waiting for players" UI already reads `pendingPlayers` and `you.result`.
5. **Geo** → replace `resolvePano` with a real Google Street View panorama lookup.
   The backend returns `panoId`; resolve it server-side (it needs the server key)
   or via the Street View JS API's `getPanorama` by id/position.

## Mock-only behaviours to remove in Phase 2

| Behaviour | Phase 1 (mock) | Phase 2 (real) |
| --- | --- | --- |
| Other players | `BOT_NAMES` auto-finalize | real lobby members over the websocket/poll |
| Auth persistence | `localStorage` users + auto-verify | cookie session + real email verification |
| `resolvePano` | location catalogue by id | Google panorama by `panoId` |
| Easy candidates | catalogue shortlist | server-generated candidate list |
| Match advancement | 1.6s grace timer in the mock | backend advances when all finalize |
| Rematch | resets match immediately | `/lobbies/:code/continue` + continue prompt |

## Remaining UI work

- **Google Maps `Marker` → `AdvancedMarkerElement`.** Google logs a deprecation
  warning; markers still work, but migrate `GuessMap.tsx` before it matters.
- **Lazy-load the 3D scene.** `HomeScene`/`AvatarPreview` pull `three` + R3F into
  the main bundle (~1.6 MB / 470 KB gzip). `React.lazy` them for a faster first
  paint.
- **Email change UI.** Settings shows a disabled "Change" button; wire it to
  `/auth/email-change/request` once SMTP is configured.
- **Audio.** Volume sliders persist and reflect state, but no sound plays yet.
  Add a tiny WebAudio layer keyed to `preferences.ts`.

## E2E tests

The existing `e2e/` specs target the old DOM and selectors. Rewrite them against
the new routes and accessible names (`getByRole`) once the backend is connected,
or delete and re-author. The Playwright smoke scripts
(`scripts/verify-v2.mjs`, `scripts/capture-final.mjs`) already validate the new
frontend and are the starting point.

## Verification gates

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` in `frontend/`
- `docker compose -f docker-compose.test.yml up --build` then `npm run test:e2e`
- Manually re-run `scripts/verify-v2.mjs` and `scripts/capture-final.mjs` against
  the real stack.

## Do not

- Modify backend endpoints, schemas, or services.
- Add new backend capabilities the UI assumes but the backend does not expose.
- Present mock data (bots, auto-verify) as real server results.
