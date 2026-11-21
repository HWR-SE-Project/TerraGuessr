# TerraGuessr — Frontend v2 Architecture

A clean-room rebuild of the TerraGuessr frontend. Phase 1 is a fully
functional, visually complete client backed by an in-memory mock layer; Phase 2
replaces the mock layer with the real backend over HTTP.

## Principles

- **One design system.** Tailwind CSS v4 + a small set of tokens (`src/styles/index.css`).
- **One Button, one Dialog, one Dropdown.** Shared primitives in `src/components/ui`.
- **Page-level state ownership.** Global state is limited to three tiny stores.
- **A single service boundary.** Pages never import mocks or HTTP directly — only `src/services`.
- **No framework sprawl.** React + TypeScript + Vite + Tailwind + React Router +
  Motion + React Three Fiber. No Redux/Zustand/React Query.

## Layout

```
frontend/src/
  main.tsx                    entry, router (createBrowserRouter)
  styles/index.css            Tailwind theme + design tokens + shared surfaces
  lib/
    contracts.ts              types mirrored from backend routes/contracts
    format.ts                 distance, scoring (R10), formatting
    difficulty.ts             difficulty presentation + rules
    motion.ts                 shared motion variants
    store.ts                  tiny useSyncExternalStore store
  services/
    index.ts                  ⭐ the service boundary (mock in Phase 1)
    mock/                     in-memory services + data (auth, singleplayer, lobbies, geo)
  state/
    session.ts                current user + auth actions
    preferences.ts            audio/language/fullscreen (guest + account)
    avatar.ts                 avatar config (guest + account)
    game.ts                   active singleplayer credentials
    lobby.ts                  active lobby membership (code + token)
  components/
    ui/                       Button, IconButton, Input, Switch, Slider, Dialog, Dropdown, Logo, Icon
    layout/                   Header (nav + account menu), SiteLayout, GameLayout
    game/                     StreetView, GuessMap, GeographicIntelligence,
                              DifficultyPicker, CandidateList, Timer, TopHud, googleMaps
  scene/                      R3F: Planet, Character, HomeScene, AvatarPreview, CosmicBackground, avatar
  pages/                      home, auth, singleplayer, multiplayer, settings, avatar, how-to-play
  assets/                     GLB models, earth fallback image, Google logo
```

## Routing

```
/                          home (3D planet + explorer hero)
/singleplayer              singleplayer setup (difficulty)
/singleplayer/play         immersive singleplayer game (GameLayout, no chrome)
/multiplayer               create / join lobby hub
/lobby/:code               waiting room
/lobby/:code/play          immersive multiplayer match
/settings                  preferences + account
/avatar                    avatar editor (3D preview)
/how-to-play               tutorial (manual only, never auto-shown)
/auth, /reset-password, /verify-email, /confirm-email-change
```

`SiteLayout` renders the cosmic background + header + page transition for normal
pages; `GameLayout` is full-screen with no chrome for active gameplay. The three
`/verify-email`, `/reset-password`, `/confirm-email-change` paths match the URLs
the backend embeds in emails.

## Service boundary (Phase 1 → Phase 2)

`src/services/index.ts` exports a single `api` object. Every page calls
`api.auth.*`, `api.singleplayer.*`, `api.lobby.*`, `api.geo.*`. In Phase 1 these
point at `services/mock/*`; in Phase 2 they are swapped for an HTTP
implementation that speaks the exact same contracts (`lib/contracts.ts`).

The mock layer mirrors the backend routes faithfully:

| Mock method | Backend route |
| --- | --- |
| `api.auth.*` | `backend/src/modules/auth/routes.ts` |
| `api.singleplayer.*` | `backend/src/modules/singleplayer/routes.ts` |
| `api.lobby.*` | `backend/src/modules/lobbies/routes.ts` |
| `api.geo.resolvePano` | Google Street View panorama lookup (server-side) |

Mock-only behaviours (clearly documented, never presented as real):
- Multiplayer bots (`BOT_NAMES`) stand in for other players.
- Auth auto-verifies on register and persists to `localStorage`.
- `resolvePano` reads the local location catalogue by id.

## 3D scene

The home hero and avatar editor reuse the shipped GLB assets
(`earth-origami.glb`, `puppet-kid.glb`). `Planet.tsx` merges the origami earth's
~214 facets into one draw call per material (7 total) for performance; `avatar.ts`
tints the character's body parts by injecting a small uniform into each
material's shader. The explorer's idle animation and cursor head-tracking come
from `useAnimations` + `useHeadTracking`. Everything honours
`prefers-reduced-motion` and falls back to a static image when WebGL is absent.

## Verification

- `npm run typecheck` — TypeScript (strict)
- `npm run lint` — oxlint
- `npm test` — vitest unit tests
- `npm run build` — production build
- `node scripts/verify-v2.mjs` — Playwright smoke checks (console errors, overflow, interactions)
- `node scripts/capture-final.mjs` — screenshots into `docs/screenshots-v2/`
