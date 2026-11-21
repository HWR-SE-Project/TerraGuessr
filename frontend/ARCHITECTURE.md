# TerraGuessr frontend

## Start here

`src/main.tsx` mounts one `SessionProvider` and the browser router. `src/App.tsx`
owns route declarations, titles, lazy page loading and the persistent cosmic
background. Home is eager; other routes are lazy. There are no barrel modules.

```text
src/
  pages/                 Route composition and feature-specific lifecycle
    auth/ home/ lobby/ settings/ singleplayer/
  components/
    layout/              AppHeader and navigation behavior
    ui/                  Button, IconButton, Input, Switch, Dialog, Modal,
                         ConfirmDialog, InlineNotice, Icon
    auth/                Email sign-in/registration and password recovery
  game/                  Controls shared by singleplayer and multiplayer:
                         Maps SDK, panorama, guess map, city selection,
                         difficulty, clues, settings, HUD, result details
  scene/                 Capability/pointer hooks and rendering boundary
    home/                Character placement, gaze, rotating Earth, fallback
    cosmic/              Persistent canvas, stars, celestial event pool
  features/avatar/       Appearance configuration, editor, shared model lifecycle
  features/preferences/  Guest account-preference persistence
  state/                 SessionContext: account and account preferences
  api/                   HTTP client, frozen DTOs, feature endpoints
  styles/                Tokens, browser defaults, shared control materials
  lib/format.ts          Shared distance, coordinate and clock formatting
  assets/                Original SVG, image and GLB runtime assets
```

## Routes and navigation

Routes: `/`, `/auth`, `/reset-password`, `/verify-email`,
`/confirm-email-change`, `/settings`, `/game/singleplayer`,
`/multiplayer/create`, `/multiplayer/join`, `/lobby/:code`,
`/lobby/:code/game`. `/multiplayer` and `/lobby` redirect to lobby creation;
unknown routes redirect Home. The existing product has no standalone Duels route.

Every page uses `components/layout/AppHeader.tsx`. Its `game` and `summary`
flags change context within the same header. `MultiplayerMenu` owns the one
Create/Join disclosure, keyboard behavior and route indication. Pages provide
help/settings/menu callbacks and optional contextual controls.

Use React Router links/navigation. `useNavigationGuard` owns router blocking
and browser unload warnings. The game page owns confirmation and server
finalization; it proceeds only after success. `GameMenu` keeps help and game
settings available when the compact header hides desktop utilities.

## UI and CSS

Use `Button` for actions, `IconButton` for labeled icon actions, `Input` for
text/email/password fields, `Switch` for boolean switches. Native selects use
`tg-field`. Keep disclosure controls, map widgets, color swatches and sliders
native when they have their own semantics.

`Dialog` owns native modality, dismissal, focus containment/return and scroll
locking. `Modal` adds the standard shell; custom tutorial/editor layouts compose
`Dialog`. `ConfirmDialog` adds confirmation actions.

`styles/tokens.css` is the token authority. CSS layers are ordered `base`,
`components`, `material`: component files own geometry; `styles/controls.css`
owns glass control/surface materials and interaction states. Shared surfaces
use `tg-glass`, with `tg-glass--panel` for the lighter blur. Never add a page
selector to a global material rule or override shared controls through `#root`.

## State and API ownership

- `SessionContext` owns the signed-in user and account/guest preferences.
- `singleplayer/useGameSession` owns one in-memory expedition, requests,
  attempts, countdown, guesses, recovery and finalization. Credentials and
  guesses are never persisted or resumed after refresh.
- `LobbyPage` derives membership from the route and stored lobby token;
  `MultiplayerGamePage` owns server polling, selection and match transitions.
  Tokens are scoped per lobby. `forgetLobby` cannot erase a newer membership.
- `useGameplaySettings` persists settings; each game owns its live values.
- The avatar service publishes saved appearance; the editor owns its draft.
  `useAvatarPersistence` handles guest/account loading, saving and identity changes.

All application requests use `api/client.ts` (`apiFetch`): JSON, cookies,
player/lobby tokens and typed `ApiError`. Feature endpoint files preserve
backend contracts. Google Maps loads once through `game/googleMaps.ts`.
The tutorial still imports the backend's existing pure distance/scoring math;
no backend code or server behavior is changed by this frontend architecture.

## 3D rendering

`CosmicBackground` keeps one application canvas. Home binds its models into
that canvas. The explorer retains its separate orthographic `Hud` depth pass;
Earth and cosmic effects retain their perspective composition. Avatar Preview
has its own canvas because it needs independent orbit controls.

`useAvatarModel` shares cached GLB loading, isolated rigs/materials, authored
idle playback, pause/resume and disposal. `AvatarLighting` supplies the same
lighting in both views. `useHeadTracking`, home layout math and planet-contact
alignment remain separate. Stars and the celestial event pool dispose their
owned GPU resources. Do not merge render passes or replace the authored model.

## Adding code

Start with local state and the existing primitives. Add a shared abstraction
only for actual reuse or a meaningful responsibility. Keep game controls out
of route directories when multiple modes use them. Keep component CSS beside
its owner and reuse tokens/materials. Add routes in `App.tsx`, use the shared
header, and preserve navigation guards. Run typecheck, lint, unit tests, build
and relevant browser tests; retain lifecycle and real-model regression coverage.
