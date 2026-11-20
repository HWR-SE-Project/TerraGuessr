# Viewport layout verification

The primary Home, Singleplayer setup, Duels, Avatar Editor, live gameplay,
round results, and session summary screens fit all five desktop reference
sizes without vertical or horizontal document scrolling:

- 1920 × 1080
- 1711 × 864
- 1440 × 900
- 1366 × 768
- 1024 × 768

Also checked 768 × 1024 and 390 × 844. Narrow and short screens can scroll;
required content remains accessible. The multiplayer lobby and secondary
weather expedition setup are included in the desktop checks.

## Evidence

- [Desktop setup](setup-1366x768.png)
- [Desktop Home](home-1366x768.png)
- [Desktop Avatar Editor](avatar-1366x768.png)
- [Desktop Duels](duels-1366x768.png)
- [Live gameplay](active-1366x768.png)
- [Round results](round-1366x768.png)
- [Session summary](summary-1366x768.png)
- [Mobile setup](setup-390x844.png)
- [Setup at 200% zoom](setup-zoom-200.png)
- [Avatar Editor at 200% zoom](avatar-zoom-200.png)
- [Reachable avatar options at 200% zoom](avatar-options-zoom-200.png)

The JSON reports contain measured document and viewport dimensions:
[sizes.json](sizes.json), [gameplay.json](gameplay.json), [zoom.json](zoom.json).
At every desktop reference size both document overflow flags are false.
Setup also has no internal card scrolling. Avatar option lists and long
session histories scroll within their panels, with actions kept available.

## Checks

`e2e/viewport-fit.spec.ts` checks document dimensions, absence of gameplay UI
during setup, control bounds and hit targets, nested option-list reachability,
expanded maps, and screenshots. Browser zoom uses Chromium's native zoom
setting at 80%, 90%, 100%, 110%, 125%, 150%, and 200%, with device pixel ratio
verification. CDP captures preserve the full screenshot bounds at high zoom.

Run from the repository root with the frontend and backend running:

```sh
npx playwright test e2e/viewport-fit.spec.ts
TERRAGUESSR_LIVE_MAPS=1 npx playwright test e2e/viewport-fit.spec.ts
```

Live coverage uses the existing Google Maps integration and backend. It starts
an expedition, places a pin, submits a guess, opens the round results, and ends
the game to inspect the summary. No panorama or scoring implementation is
replaced. The live test requires configured Maps credentials. The two other
tests do not require live gameplay, and can inspect the setup unavailable state.

Additional verification used the existing responsive, Home, avatar, and Duels
suites; the live six-round/mobile flow; and the genuine live browser-zoom test
that verifies panorama and pin retention. The existing zoom regression also
checks settings, tutorials, active-game error states, and summary controls up
to 200% zoom. Frontend unit tests: 125 passed. Production build succeeded.

Two avatar checks timed out in the legacy headless-shell renderer during
concurrent runs. Both passed in Chromium's current headless mode without
product changes. The new viewport suite explicitly uses current Chromium,
matching its native browser-zoom checks.

The broader account-dependent Home/identity tests could not complete because
registration returned an existing HTTP 500 / “Internal server error” from the
running backend. That is outside this layout-only change. Guest navigation,
Duels error recovery, avatar persistence/customization, and the dedicated
viewport and live Street View checks were verified separately. Backend and
authentication code were not modified.
