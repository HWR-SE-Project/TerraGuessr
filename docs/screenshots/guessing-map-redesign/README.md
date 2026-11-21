# Singleplayer guessing map redesign

The world map now uses one restrained translucent surface, a 36px desktop header, an unframed map, and a 36px lime submit button. A small expand icon replaces the glass button. The placement hint sits below the map; the countdown and remaining attempts remain available without stacked header metadata. Touch targets grow to 44px. Disabled submission uses a neutral surface distinct from the active lime state.

On narrow screens and at high browser zoom, the map docks below a separate Street View viewport. Desktop reserves a right gutter for native Street View controls, including indoor floor selection. Google map zoom controls, attribution, keyboard help, and Terms links retain their own unobstructed map area. Short windows scroll naturally instead of clipping controls.

## Visual evidence

- [Before](before-desktop.png) and [after](after-1440x900.png) at 1440×900. Different real panoramas were used. The new map frame measures 338×234px within a 340×343px panel.
- [Expanded desktop map](desktop-expanded.png), [collapsed panel](collapsed.png), and [disabled submit](desktop-disabled.png).
- [Phone](after-390x844.png), [small touch phone](touch-320x568.png), and [expanded phone map](mobile-expanded.png).
- [Native browser zoom at 200%](zoom-200.png).
- [Remaining attempt and final submit](remaining-attempt.png) and [completed round](submitted.png).

`viewport-report.json` records eight viewport sizes: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 320×568, and 844×390. `zoom-report.json` records genuine Chromium browser zoom at 80%, 100%, 125%, 150%, and 200%. All checks found no horizontal overflow, no panel/control intersections, and no covered Street View buttons or links. The map zoom buttons, Terms link, and submit button were hit-tested for reachability. Small phones and short/zoomed windows intentionally allow vertical page scrolling.

## Functional verification

Four live Playwright tests passed with real Google Maps, real Street View, and the running backend. No network responses were mocked or adapted in the final tests. Coverage includes pin placement and dragging, map zoom, expansion, collapse/restore, pin and panorama preservation through viewport changes and browser zoom, touch placement, initial and final submission, Enter submission, hover expansion, and Escape. The desktop screenshots also show the indoor floor selector remaining accessible beside the map.

Run with:

```sh
TERRAGUESSR_LIVE_MAPS=1 npx playwright test e2e/guessing-map-panel.spec.ts
```

All 41 existing targeted map, Google Maps loader, session, and singleplayer tutorial tests passed. The frontend production build and lint passed; lint retains existing warnings in unrelated files, and the build retains its existing large-chunk warning. No changes were pushed.
