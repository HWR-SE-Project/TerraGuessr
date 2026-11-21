# TerraGuessr design overhaul

The application now shares one navy, off-white, and lime identity. The work
covers Home, Duels, authentication, Street View gameplay, round results, final
results, account settings, password reset, the weather expedition, shared
challenges, and their existing dialogs.

## Visual changes

- A shared geometric explorer mark, wordmark, favicon, and consistent navigation.
- Confident, upright Inter typography replaces the inconsistent italic-heavy
  treatment. Hierarchy, readable secondary text, aligned numeric statistics,
  spacing, borders, cards, inputs, and button dimensions now share foundations.
- Home retains its centered heading, explorer, Earth horizon, space setting,
  and three game-mode cards. Copy, spacing, responsive composition, and the
  restrained orbit details were composed together.
- Duels retains the two characters, emblem, Earth, rank preview, placements,
  and working async challenge action. The preview is explicitly labelled;
  no ranking, currency, player level, or live opponent data is fabricated.
- Authentication uses the same brand, Earth atmosphere, surfaces, and controls.
  Email registration, validation, login, recovery, and existing provider
  availability handling remain connected to the real backend.
- Gameplay keeps the panorama dominant. The score instrument sits at the top
  on desktop and along the bottom on phones. Compact controls, the map,
  Geographic Intelligence, menus, and settings share the same visual language.
- Results use a generous map-and-score composition on desktop and a vertical
  layout on phones. Progression actions remain visible while details scroll.
- Account settings were rebuilt as a bounded, scrollable panel with clear
  tabs and consistent fields. Escape now respects an open delete confirmation.
- The older weather modes share the new surfaces and control styles. Setup
  explains the server's existing policy: Easy uses a list, Hard uses the map,
  and Medium offers both. It no longer offers a choice that is silently ignored.

## Design system

`frontend/src/design-system/tokens.css` is the foundation. Core values:

| Token | Value / purpose |
| --- | --- |
| Background | `#080f1b` |
| Surface / raised surface | `#101c2c` / `#162437` |
| Text / secondary / subtle | `#f4f7fb` / `#a4b3c5` / `#768ba3` |
| Primary lime | `#c0f66b`; dark text `#172512` |
| Geographic cyan | `#83d5ed` |
| Special interaction purple | `#b5a0ef` |
| Streak orange | `#f7b16b` |
| Achievement gold | `#e9cc84` |
| Error red | `#ff9b9e` |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64px |
| Radii | 8px small; 12px controls; 20px cards; 28px panels |
| Primary control height | 48px; compact icon controls 44px |
| Navigation | 88px desktop, 76–80px compact |
| Font | Inter variable, 400–800; system fallback |
| Motion | 160ms controls, 280ms panels, consistent easing |

`components/ui/Brand` and `Button` provide shared React primitives.
`PageNavigation` reuses the common navigation and accessible availability dialog
on the existing weather routes. Existing native dialogs, game settings, map,
weather card, candidate list, loading, validation, and error components remain
reused. `design-system/product.css` bridges established game components to the
tokens, with scoped specificity that remains stable when route CSS loads lazily.

## Earth, character, and motion

The active Earth renderer uses locally stored Solar System Scope textures,
licensed under CC BY 4.0. The source and transformations are recorded in
`frontend/public/asset-credits.txt`, linked from Home. Day imagery is 4K on
desktop and 2K on initially narrow screens; the cloud map is 2K WebP.

A custom surface shader composites clouds with the planet's lighting, avoiding
intersections from the previous transparent cloud shell. A restrained Fresnel
atmosphere uses the actual view direction and a sun-aware color transition.
Rotation and parallax are substantially slower. Stars remain small and sparse.

The crude primitive character is no longer rendered. The existing polished
explorer illustration provides the intentionally selected 2D fallback, with
subtle idle motion. Duels retains its existing rendered character assets. This
work does **not** claim a new professionally rigged 3D character model.

Decorative WebGL is lazy-loaded, capped at 30 frames per second, and stops
requesting frames in hidden tabs. Device pixel ratio is capped at 1.5. Reduced
motion disables ongoing scene scheduling and CSS animation. A static Earth
composition remains available while loading and when WebGL is unavailable.

## Performance

Route splitting reduced the initial JavaScript chunk from approximately 486KB
(148KB gzip) to 230KB (72KB gzip). Leaflet and secondary routes load when used.
The Duels emblem was converted from a 932KB PNG to an 82KB WebP, about a 91%
reduction. Earth texture delivery totals about 530KB on an initially narrow
screen and 905KB on desktop. No new runtime dependency was introduced.

Three.js and React Three Fiber still form a roughly 929KB lazy chunk (246KB
gzip), producing Vite's size advisory. It is not part of the initial route
bundle. No Lighthouse score or sustained mobile GPU benchmark is claimed.

## Review and verification

See the [before/after screenshot gallery](screenshots/overhaul/README.md) and
[viewport report](screenshots/overhaul/after/visual-qa.json). The screenshot
script exercises the real Google panorama, real guess map, and five real
server-scored rounds; screenshots are not fixtures or substituted images.

The representative matrix includes all seven requested sizes. Browser captures
were inspected and used to correct clipping, mobile result actions, navigation,
Earth materials, typography, lazy CSS order, and map/overlay composition.

Final test results are recorded in [verification.json](screenshots/overhaul/verification.json):
52 frontend unit tests, 179 backend unit tests, 29 production E2E tests, and
3 unavailable-provider E2E tests passed. Final targeted reruns passed 4 Duels
and 2 Home tests. TypeScript, ESLint, Oxlint, and the production build passed;
Oxlint reports the five existing warnings noted below. The main viewport audit
passed 59 combinations with zero page errors. The last visual refinement rechecked
Home at all seven sizes and the duel action at both phone sizes.
The test coverage includes registration, login, logout, validation, account
updates, preference persistence, deletion of a test account, navigation,
async challenge sharing, map/list play, real Street View
movement, mobile touch guessing, pin persistence, score calculations, results,
restart, Geographic Intelligence, protected location data, unavailable-provider
behavior, Escape, and focus restoration.

Earlier runs exposed three test-environment issues: the disconnected local API
proxy, account registration throttling, and tests that requested modes contrary
to the existing server difficulty policy. The local backend was started, live
registration can now be paced with `PLAYWRIGHT_REGISTRATION_INTERVAL_MS`, and
mode tests use supported choices. The map test helper also now waits for the
active round's map rather than racing against the previous result map. Daily
tests use a unique name to avoid collisions with past development results.

## Limitations

- Ranked/live duels, avatar editing, and search retain honest availability
  notices. Apple/Facebook login are still unavailable; Google depends on the
  existing OAuth configuration. The running backend disables password recovery
  because its email service is not configured; recovery email delivery and
  an external OAuth provider round trip could not be verified.
- Five pre-existing Oxlint React warnings remain; ESLint has no errors. Backend
  ESLint, typecheck, and unit tests also run successfully.
- The weather failure-injection E2E requires the dedicated fake-weather service;
  it was not used against the live weather backend. Weather fallback behavior is
  covered by the existing backend unit tests.
- Verification uses Chromium. Safari/Firefox, physical mobile devices, and
  production hosting were not tested. No infrastructure or database schema was
  changed, and no remote push or deployment was performed.
- The static character fallback is intentional; no unsuitable 3D approximation
  is substituted for it. Existing Duels artwork is retained.

## Local review

- Development Home: http://localhost:5173/
- Production preview Home: http://localhost:5175/
- Authentication: http://localhost:5175/auth
- Duels: http://localhost:5175/duels
- Street View: http://localhost:5175/game/singleplayer
- Weather expedition: http://localhost:5175/play
- Account settings: http://localhost:5175/settings
- Password recovery state: http://localhost:5175/reset-password

Results are reached through a real game; shared challenges use the actual
created challenge URL. They are not invented standalone routes.

The local backend listens on port 3005. To restart it from `backend/`:
`PORT=3005 NODE_ENV=test node --env-file=../.env --import tsx src/server.ts`.
The existing local frontend proxy points to that backend. Run
`npm run dev --prefix frontend` or `npm run preview --prefix frontend -- --port 5175`
from the application root as appropriate. The preview requires a production
build (`npm run build --prefix frontend`).

The pre-overhaul application is recoverable at local checkpoint `94d4031`.
