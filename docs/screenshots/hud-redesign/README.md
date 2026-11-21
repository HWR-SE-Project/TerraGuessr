# Compact round and score HUD

The shared singleplayer/multiplayer HUD now displays `Round 1` and `0 pts` on one line in a 40px-high translucent bar. Icons, separators, stacked captions, the shared heavy glass material, and the visible status row were removed. Screen readers still receive round totals, total-score context, and status changes through a polite, atomic live region. The multiplayer HUD uses the shared footer layout to reserve space around gameplay controls.

## Visual verification

Real Google Street View was inspected at 1440×900, 1920×1080, 1024×768, 768×1024, 390×844, 320×568, and 844×390. Every viewport had a 40px-high HUD, no horizontal overflow, and no intersections with the guessing panel, navigation, compass, or geographic intelligence controls. Short viewports retain the existing scrolling gameplay layout. Screenshots include bright outdoor and darker indoor imagery.

`verification.json` records browser geometry and the actual scored-round response. `after-round-update.png` shows Round 2 with the accumulated 117 points. The running Docker backend returns a legacy unwrapped result; this check used a browser-only response adapter to put that real result into the current frontend's `{ finalized, attemptsRemaining, result }` contract. Application gameplay logic and the backend were not changed.

## Checks

- Frontend production build passed.
- Frontend lint passed with existing warnings in unrelated files.
- All 23 `useGameSession` tests passed.
- Existing multiplayer navigation test passed.
- Two broader existing tests failed on missing navigation/tutorial menu labels, outside the HUD: `session-navigation.spec.ts` (responsive header) and `tutorial.spec.ts` (actual targets/session preservation).
