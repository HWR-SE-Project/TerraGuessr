# Official Duels page implementation

Local URL: http://localhost:5173/duels

## Navigation update requested after the initial implementation

The user subsequently requested the same navigation as Home, then explicitly requested removing Singleplayer, Multiplayer, Party, the account/currency block, and the Daily Challenge / Competitive / World cards from Home as well. After a further correction to restore navigation, both routes now reuse `HomeNavigation` with the TerraGuessr home link, Singleplayer, Multiplayer, Party, and the mobile menu. Singleplayer is active on Home and Multiplayer on Duels. The account/currency block and Home activity sidebar remain removed. The floating Duels rail and mobile bottom bar are removed. Home retains its hero, avatar control, and Play Solo / Play Together / Compete game-entry cards.

Home intentionally differs from the original checkpoint because of that explicit follow-up. Auth remains pixel-identical, and authentication, settings, API contracts, backend, and schema remain unchanged. The following captures and implementation notes reflect the latest requested state.

Git checkpoint before implementation: `a96164f` (`checkpoint: preserve current application before official duels rebuild`). Existing uncommitted Home work was included in this checkpoint and preserved. No changes were pushed.

## Reference status and visual evidence

**No reference screenshot was attached to the task received by the agent.** The exact source dimensions, source comparison, and pixel-perfect acceptance cannot be verified. The implementation uses the detailed written brief and existing application artwork. It must not be represented as a verified reproduction of an unseen screenshot.

The desktop capture is 1792 × 861, the provisional resolution in the brief. This is not a confirmed measurement of the missing original.

- `desktop-1792x861.png`: final browser capture using an existing authenticated local account, BrowserExplorer.
- `desktop-guest-1792x861.png`: signed-out state.
- `mobile-390.png`: 390 × 844 browser viewport at the top of the page.
- `mobile-ranks-390.png`: mobile viewport after scrolling to the ranking panel.
- `mobile-full-390.png`: full mobile document with the shared brand header and no bottom navigation.
- `tablet-768.png`: tablet layout.
- `laptop-1280.png`: laptop layout.
- `before-duels.png`: pre-change application page, **not the missing design reference**.
- `before-after.png`: side-by-side old/new implementation, **not a source-reference comparison**.
- `before-home.png` / `after-home.png`, `before-auth.png` / `after-auth.png`: visual regression evidence.
- `regression-results.json`: Home and Auth pixel comparison results. Auth is pixel-identical; Home has the explicitly requested navigation/card removals.
- `browser-results.json`: console errors and responsive layout measurements.
- `navigation-results.json`: restored navigation, correct active items, Party notices, and no account/sidebar controls at 320, 390, 768, and 1792 px.
- `home-mobile-cleaned-390.png`: Home after the requested navigation/card removals.

Reproduce browser captures with `node docs/screenshots/duels/capture.mjs` from the application root. It expects the existing ignored local test session at `docs/screenshots/home/session.local.json`; session cookies are not included in these deliverables. Set `PLAYWRIGHT_BASE_URL` to select another running frontend.

Run `python3 docs/screenshots/duels/compare.py` for regression checks and the old/new comparison. Once an actual same-size source image is available, pass `--reference /path/to/reference.png` to preserve the original and generate the source side-by-side, 50% overlay, and amplified difference. The script rejects mismatched dimensions rather than silently rescaling the reference.

## Components

The real `/duels` route now renders one responsive React tree instead of mounting separate desktop/mobile canvases. It includes the realistic Earth and contour background from Home, the shared Home header, main navigation, and TerraGuessr home link, italic DUELS title and green laurels, existing transparent explorer/purple opponent artwork, the original neon duel emblem, three placement controls, lime PLAY button, and glass ranking panel with all five original rank emblems and colored progression markers.

On phones and tablets, the rank ladder becomes horizontal below the play area and the shared header stays at the top. The Play button remains at least 44 px tall at all checked sizes. Labels truncate long usernames. The default portrait reuses the existing explorer asset; it does not claim to be an uploaded account avatar.

All new page styling is scoped to `td-*`. Routing, authentication, Auth, global styles, and backend implementation were not changed. Home account controls and sidebar cards were removed at the user’s explicit follow-up request. The shared main navigation was restored at their subsequent request.

## Working interactions and backend integration

- Actual authenticated display name, session loading state, guest fallback, and real daily streak.
- Shared Singleplayer, Multiplayer, Party, mobile navigation, and TerraGuessr home link on both pages; Home game-entry cards remain. Daily and settings routes remain available. Party displays an honest availability notice.
- PLAY starts the existing single-round async challenge flow using the real games/rounds/challenges APIs, with loading and recoverable error states.
- Native modal dialogue traps keyboard focus; Escape closes it when safe and restores focus to PLAY.
- Guess submission creates a real shareable challenge. Fixed an existing frontend handoff bug: the creator's actual completed result and guess now reach the challenge page so the creator can submit their result to the shared leaderboard without replaying the revealed location.
- An independent browser can join the same challenge, play it, submit its result, and appear on the same real leaderboard.
- Placement buttons explain that ranked placement is unavailable. They do not change progress or send game creation requests.
- Availability notices support keyboard dismissal and focus restoration.

## Unsupported functionality

The inspected backend supports async challenges, not live head-to-head matchmaking or ranked play. There are no placement-series, competitive-rank, country, or uploaded-avatar fields in the account contract. Consequently:

- The ranking ladder is explicitly labeled a preview; UNRANKED is the displayed unassigned state, not fetched competitive data.
- Duel 1–3 are demonstration controls; no completion state or placement result is fabricated.
- The opponent remains Unknown player.
- PLAY explicitly describes async challenges and does not pretend to enter live ranked matchmaking.
- No German country flag is assigned to an account without country data.
- The existing default explorer portrait is used rather than an invented account avatar.

No backend APIs or database schema were modified.

## Verification

Final checks:

- Frontend TypeScript and production build: PASS (`npm run build`).
- Unit tests: 25/25 PASS across five existing test files (`npm test`). The existing duel handoff test now verifies the actual result and guess as well as share URL.
- Relevant Playwright end-to-end tests: 20/20 PASS across the relevant Duels, Home, async challenge, navigation, authentication, and settings suites (including a targeted rerun after correcting a login-test wait).
- Two independent browsers both enter the actual challenge leaderboard: PASS.
- New tests cover real session names, preview labeling, no fake progression/API mutation, keyboard notices, launch error recovery, focus restoration, and responsive layout.
- Console/page errors during capture: none.
- Horizontal overflow: none at 320, 360, 390, 600, 768, 1024, 1100, 1280, 1440, 1792, and 2100 px.
- Home screenshot versus checkpoint: expected differences from the user-requested removal of account controls and sidebar cards.
- Auth screenshot versus checkpoint: pixel-identical.
- Auth source, session context, router, global CSS, backend, and schema: unchanged versus checkpoint. Home exports the shared header and removes the requested account controls/cards; Home CSS aligns the restored mobile toggle.
- Lint: passes with five pre-existing warnings in unrelated files; no new Duels warnings.
- `git diff --check`: PASS.

Tests cover the restored main navigation, mobile menu, correct active items, remaining game-entry cards, and shared home link. The removed account/sidebar controls remain absent. Registration and logout checks verify the actual session API; real account names are still verified on Duels. Settings tests visit the preserved settings route directly. The existing multiplayer test now uses the backend's medium-difficulty list selection, matching the existing challenge page and Home integration test. Checks tied to the explicitly removed controls were replaced with assertions that those controls are absent; session identity, login persistence, logout, account editing/deletion, and playable game flows remain covered.

During verification, the new focus-restoration test exposed a failure that was fixed. The existing multiplayer test exposed the creator-result handoff bug that was fixed. One initial parallel test run hit the existing account-registration rate limit; the subsequent sequential runs passed without changing backend limits.

## Remaining visual discrepancies / acceptance gap

Reference-relative layout, Earth cropping, type sizing, colors, artwork placement, and spacing cannot be measured until the original reference is supplied. Existing high-quality local artwork is reused. The laurels are local SVG graphics; both routes reuse the same Home brand header. Country flags are intentionally absent because account country is not available. Small availability captions are present to distinguish the design's ranked affordances from supported async gameplay.

**The implementation and functional verification are complete; reference-based visual acceptance remains pending.**

Latest navigation correction: TypeScript/production build and 11 Home/Duels/navigation browser tests pass. Navigation and Party availability notices were also checked at 320, 390, 768, and 1792 px.
