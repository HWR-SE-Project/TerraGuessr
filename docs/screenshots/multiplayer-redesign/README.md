# Multiplayer entry redesign

The entry page now presents two compact actions before asking for any settings. Choose **Create a lobby** or **Join a lobby** to reveal one form. Switching modes retains the display name and hosting choices. No game rules, API contracts, backend source, database schema, or cosmic background code changed.

## Before and after

| Before | After |
| --- | --- |
| Two stretched panels, both forms visible, a detached display-name field | Two lightweight action cards, no fields until a player chooses an action |
| A large stack of difficulty controls and eight round-count buttons | Three compact native radio choices and one dropdown covering every value from 3 to 10 |
| Join code and button separated by a large empty card | A short Join form with code, optional name, and one primary action |
| Desktop capture was 970px tall at a 1711 × 864 viewport | Default, Create, and Join each fit every required desktop viewport |
| Click-only submissions and transient error messages | Enter submits; invalid codes receive associated inline feedback and focus; request errors persist until retry or mode change |

The `before` screenshots capture the actual running page before this change.

| View | Desktop | Mobile |
| --- | --- | --- |
| Before | [1711 × 864](before/desktop.png) | [390 × 844](before/mobile.png) |
| Default | [1711 × 864](after/default-1711x864.png) | [390 × 844](after/default-390x844.png) |
| Create | [1711 × 864](after/create-1711x864.png) | [390 × 844](after/create-390x844.png) |
| Join | [1711 × 864](after/join-1711x864.png) | [390 × 844](after/join-390x844.png) |

Additional screenshots cover each tested size, validation feedback, browser zoom, and real lobby membership.

## Interaction and accessibility

- Both action cards remain available. Exactly one configuration form can be mounted. Expanded state is exposed with `aria-expanded` and `aria-controls`.
- Create preserves Easy: 7 minutes, 3 attempts, list selection; Medium: 4 minutes, 2 attempts, world map; Hard: 2 minutes, 1 attempt, world map. Native radio inputs support arrow-key navigation and full-label touch targets.
- Round count defaults to 5 and supports every existing count from 3 through 10.
- Display name stays optional, prefills from the account when available, and retains user edits across flows. Guest access requires no sign-in.
- Join uppercases input, permits only the backend's A–Z and 0–9 character set, and accepts complete pasted codes, including codes with surrounding whitespace or separators. Incomplete submissions do not call the API.
- Loading disables the current form and mode switches, displays progress text and a small indicator, and permits retry after failure.
- Small fade/position transitions, hover highlights, focus indicators, and tactile button states respect reduced-motion preferences. Opaque fallback surfaces support reduced transparency.
- Existing shared `PageNavigation` remains in use. Home, Singleplayer, Duels, Tutorial, Settings and Sign in were checked on desktop and mobile; Multiplayer is active. No duplicate Home button was added.

## Viewport verification

All three states were checked at every size below. All visible form controls were scrolled into view and hit-tested to ensure they were reachable rather than clipped.

| Viewport | Result |
| --- | --- |
| 1920 × 1080 | No horizontal or vertical page scrolling |
| 1711 × 864 | No horizontal or vertical page scrolling |
| 1440 × 900 | No horizontal or vertical page scrolling |
| 1366 × 768 | No horizontal or vertical page scrolling |
| 1024 × 768 | No horizontal or vertical page scrolling |
| 768 × 1024 | No horizontal overflow; controls reachable |
| 390 × 844, 375 × 812, 320 × 568 | Stacked intent cards and compact difficulty rows; natural scrolling keeps every control reachable |
| 683 × 384 | No horizontal overflow; controlled vertical scrolling |

Native Chromium browser zoom was separately exercised at 80%, 100%, 125%, 150%, and 200% in all three states. At increased zoom the document scrolls as needed, without hiding controls or introducing horizontal overflow. The 1711 × 864 native browser window has a 1711 × 777 content viewport at 100% due to browser chrome.

Raw measurements: [viewport-results.json](after/viewport-results.json), [zoom-results.json](after/zoom-results.json).

## Functional verification

The browser suite uses real lobby HTTP endpoints for its lifecycle scenario. Two independent guest browser contexts create separate rooms, disband one, return to entry, join the other using a lowercase pasted code, observe both members, reload to resume membership, leave, and disband the remaining room. It verifies that only the host can start and that the selected three rounds persist on the backend.

A separate real-browser smoke check created an Easy, three-round lobby, joined from a second context, and clicked Start match. The source backend returned HTTP 200 with lobby status `playing` and `roundsTotal: 3`, and the host navigated to `/lobby/<code>/game`. [Started match capture](after/live-started-match.png).

Error/loading scenarios use explicit response interception so failures are reproducible. The real lobby integration suite covers validation, permissions, membership, start, guessing, match progression, and cleanup without depending on third-party weather or panorama availability.

Final results:

- `PLAYWRIGHT_BASE_URL=http://localhost:8083 npx playwright test e2e/multiplayer-entry.spec.ts`: **10 passed**.
- `npm --prefix frontend test`: **19 files, 122 tests passed**.
- `npm --prefix frontend run build`: **passed** (TypeScript and Vite).
- `npm --prefix frontend run lint`: **passed**, with existing warnings in the workspace.
- Lobby backend integration tests against the isolated review database: **18 passed**.
- `git diff --check` for the changed implementation and viewport test: **passed**.

## Files changed for this task

- `frontend/src/pages/lobby/LobbyPage.tsx`: intent selection, exclusive configuration form, compact controls, shared name state, paste handling, keyboard submission, persistent request errors, and waiting-room feedback rendering.
- `frontend/src/pages/lobby/LobbyPage.css`: compact translucent surfaces, balanced desktop layout, mobile composition, touch/focus states, and restrained motion. Existing waiting-room styling is retained.
- `e2e/multiplayer-entry.spec.ts`: interaction, validation, loading, profile prefill, real guest lifecycle, navigation, invitation URLs, viewport checks, and screenshot capture.
- `e2e/viewport-fit.spec.ts`: added `.tl-choice` to the existing lobby control selector so the suite recognizes the new default state. Other existing changes in that file belong to prior/concurrent work.
- `docs/screenshots/multiplayer-redesign/`: screenshots, measurements, and this report.

The workspace contained other unrelated edits before and during this task. Those were preserved and are not part of this change.

## Local preview and limitations

Preview: **http://localhost:8083/multiplayer**. It uses the current source backend on port 3006 and an isolated temporary PostgreSQL review container (`terraguessr-multiplayer-review-db`, port 55440), initialized using existing migrations. No existing application database was changed.

The original frontend on port 8080 still points to an older Docker backend on port 3004. That runtime returns five rounds even when three are requested and returns 404 for match start. The checked-out backend supports both correctly; the preview and successful lifecycle verification use that current code. The existing Docker runtime was left untouched.

Browser verification used Chromium and mobile viewport emulation; physical mobile keyboard, Safari, and Firefox behavior were not separately tested. End-to-end completion of an entire live multiplayer match was outside this entry redesign; match initialization was verified in a real browser and match behavior is covered by the backend integration suite. The production build reports a non-blocking existing large-chunk warning.

No changes were pushed to a remote repository.
