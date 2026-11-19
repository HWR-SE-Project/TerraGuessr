# TerraGuessr official Home Page

Latest requested revision: The activity cards are vertically centered on desktop, the hero description is removed, and the header now uses centered text-only Singleplayer / Multiplayer / Party navigation with a mountain profile placeholder and no level ring.  Go Premium, the daily streak/calendar card, and Shop have been removed. Desktop navigation is centered horizontally on the viewport. Home remains public as Guest. Current browser captures: [desktop](updated-desktop.png), [mobile](updated-mobile.png). The original reference comparison below documents the initial implementation before these requested changes.

Local URL: **http://localhost:5173/**. The new page is the actual authenticated `/` route. Temporarily, signed-out visitors also see the Home Page as Guest, without a login gate. Authentication remains available directly at `/auth`. `/auth` and `/duels` retain their existing implementations.

Pre-change Git checkpoint: **bf7d58e** (`checkpoint: preserve current app before official home rebuild`). The checkpoint includes the application changes that were already in the working tree when this task began. No changes were pushed remotely.

## Visual deliverables

- [Final desktop browser capture, 1711 × 864](desktop-1711x864.png)
- [Original supplied reference, 1765 × 891](reference-original.png)
- [Reference normalized to the requested 1711 × 864 viewport](reference-1711x864.png)
- [Side by side: reference left, implementation right](side-by-side.png)
- [50% overlay](overlay.png)
- [Absolute pixel difference](difference.png)
- [Mobile, 390px wide, full page](mobile-390.png)
- [Tablet, 768px wide](tablet-768.png)
- [Laptop, 1280 × 800](laptop-1280.png)
- [Browser layout and console results](browser-results.json)

The supplied file's actual size differs from the brief's reference resolution. It was proportionally normalized for comparison. Desktop captures were taken in real headless Chromium at exactly 1711 × 864, with the real signed-in account `BrowserExplorer`. The screenshot is not a fabricated session or screenshot-only route.

The first pass was compared side by side; subsequent passes corrected headline width, background brightness/saturation, character material and proportions, and laptop horizon placement. The final desktop card positions include sidebar x40/y131/width295, premium x1300/y167/width378, and mode cards x388/y723. No claim of exact pixel equality is made.

## Implementation

`HomePage` now renders one `HomeExperience` immediately for signed-in users and guests, with the login gate temporarily removed. Guests see an explicit Guest identity and do not fetch protected daily statistics. The duplicated old desktop/mobile Home implementations were removed.

Reusable components in `HomeExperience.tsx` implement navigation, session profile summary, circular level display, activity sidebar, hero/avatar, game-mode cards and availability dialog. `HomeIcon.tsx` contains local SVG icons. Home styles are isolated under `th-` selectors. Tablet and mobile reorganize content and navigation instead of shrinking the desktop canvas. Reduced-motion preferences, visible focus, skip navigation, native modal focus trapping, Escape dismissal and focus restoration are supported.

`useHomeData` now fetches only the actual daily challenge for all responsive sizes and handles API failures. The unused streak/statistics request and calendar code were removed. The profile uses the real display name and actual daily-streak count. The API has no user-avatar URL, so the profile circle displays the account initial. Missing currency/level values are shown as unavailable dashes, without invented progress.

Strict TypeScript checking is enabled for the frontend. No runtime dependency was added. Three optimized local WebP assets total approximately 346 KB. [Asset provenance and all final imagegen prompts](../../../frontend/src/assets/home/official/README.md) document the built-in imagegen generations and local saved paths.

## Connected functionality

| Control | Existing functionality |
| --- | --- |
| Singleplayer / Play Solo | `/play`, existing game setup and gameplay |
| Multiplayer / Play Together / Compete / Competitive | `/duels`, existing async friend challenges |
| Streak / Daily Challenge | `/daily`, real daily challenge and leaderboard |
| Profile avatar | `/settings`, existing account settings |
| TerraGuessr brand | `/` |
| Mobile menu | Accessible disclosure for the complete main navigation |

Browser tests completed a three-round medium/map solo expedition through the new Home entry point. A second test created a real challenge from Play Together; an independent browser played the existing candidate-list flow and submitted a leaderboard entry.

## Unsupported backend features

Party lobbies, community, shop, global player/map search, editable avatars, persistent profile images, levels/XP, currency, premium subscriptions, subscription-only World access, and payment processing are not available in the current API. These controls explain their unavailable state in a native accessible dialog. The premium text/pricing reproduces the reference as a preview; it cannot purchase or activate anything. Ranked matchmaking and global rankings are not invented; competitive entry points lead to supported async Duels.

## Verification results

| Check | Result |
| --- | --- |
| Frontend strict TypeScript (`tsc -p tsconfig.app.json --strict --noEmit`) | Passed |
| Production build (`npm run build`) | Passed |
| Frontend unit tests | 25 / 25 passed |
| Frontend configured lint (`oxlint`) | No errors; 5 existing warnings outside Home |
| ESLint on all new Home TSX and modified Home hook | Passed using the existing backend TypeScript ESLint configuration |
| Backend typecheck and ESLint | Passed |
| Backend unit tests | 159 / 159 passed |
| New Home Playwright suite (`e2e/home.spec.ts`) | 5 / 5 passed |
| Browser Home console/page errors | None |
| Horizontal overflow at 320, 390, 768, 1024, 1280, 1711, 2100px | None |
| Authentication | Registration, persistent session, logout, login, invalid password and validation passed |
| Routing/account | Signed-in navigation, signed-out gates, account editing/preferences/deletion passed |
| Daily challenge | Completed and submitted successfully in initial full-suite run |
| Git diff check | Passed |

The full existing Playwright suite is **not entirely green**: the initial run had **14 passes and 4 failures**. None of the failing existing tests were deleted or weakened:

1. Existing solo map test requests Easy but expects a map; the frozen backend enforces Easy → list.
2. Existing solo list test requests Hard but expects candidates; the frozen backend enforces Hard → map.
3. Existing two-player challenge test expects a creator leaderboard-entry form immediately after creation; the existing Challenge page starts in its idle state instead.
4. Weather-fallback test requires a fake weather service on localhost:4001, which is not running in the current stack.

The first three failures were reproduced from **bf7d58e** in a temporary detached worktree against the same backend (`http://localhost:3004`). Those application flows were left unchanged. The new Home gameplay tests exercise the modes the backend actually supports.

A follow-up run of auth/navigation/settings/daily/Home/network checks had 14 passes and one daily-test failure: the shared database now had multiple previous entries named `Daily Player`, while the existing test assumes exactly one row with that name. The initial daily flow passed, and the repeated run again completed gameplay and submission before that row-count assertion. This is documented rather than hiding the failure or changing the daily page.

The build reports the existing approximately 502 KB JS chunk warning. Integration tests requiring a separately isolated database/weather stack were not run.

## Remaining visual differences

- The Earth/cloud geography, alpine landscape and character are reference-guided generated replacements, not exact source exports. The UK/continent placement, clouds, mountain peaks, character face/hair and pose therefore differ in detail.
- Local SVG icon geometry, a few font metrics and some border/lighting details are approximate.
- Actual account identity, account-initial avatar, current calendar/countdown and unavailable level/currency replace the reference's example profile values.
- Competitive supporting copy describes supported friend challenges rather than falsely promising ranked play.

## Preservation and reproduction

`git diff bf7d58e -- backend frontend/src/pages/auth frontend/src/pages/duels frontend/src/App.tsx frontend/src/index.css` is empty. Auth and Duels remain functional in browser checks. Backend source, database schema and API contracts were not modified; no new backend regression was detected. The pre-existing suite failures above prevent claiming that every existing gameplay test is green.

The existing development server remains available at http://localhost:5173/. For a fresh local run against the same existing backend:

```sh
cd frontend
VITE_DEV_API_PROXY_TARGET=http://localhost:3004 npm run dev -- --port 5173
```

From the application repository root:

```sh
node docs/screenshots/home/capture.mjs
python3 docs/screenshots/home/compare.py
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test e2e/home.spec.ts
```

`capture.mjs` creates a real test account through the existing registration UI. Its temporary session state is excluded from Git by `*.local.json`.
