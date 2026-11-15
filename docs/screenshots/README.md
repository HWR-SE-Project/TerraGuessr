# Browser evidence

Captured from the running application using Chromium against an isolated Docker Compose stack with deterministic test weather.

- `phase1-desktop-home.png` — 1440px landing page.
- `phase1-desktop-game.png` — 1440px Easy mode with five distinguishable choices.
- `phase1-desktop-map.png` — 1440px Hard mode after placing a map marker.
- `phase1-mobile-home.png` — 375px landing page.
- `phase1-mobile-game.png` — 375px Easy mode.
- `phase2-desktop-dashboard.png` — 1440px authenticated dashboard after email registration.
- `phase2-mobile-settings-de.png` — 375px settings page with the persisted German interface preference.
- `phase3-mobile-setup.png` — 390px game setup with the configurable solo round count.
- `phase3-mobile-attempt-result.png` — 390px intermediate attempt feedback with the answer still hidden.
- `phase4-daily-dashboard.png` — 1440px authenticated dashboard with the shared UTC challenge.
- `phase4-daily-game.png` — 1440px Daily Challenge with Open-Meteo values and map guessing.
- `phase4-daily-result.png` — 1440px submitted result, revealed location and persisted daily placement.
- `phase4-daily-statistics.png` — 1440px account-owned Daily history and average score/distance.
- `phase4-daily-leaderboard.png` — 1440px date-selectable Daily leaderboard and current placement.
- `phase4-mobile-daily-leaderboard.png` — 375px Daily leaderboard layout with no page overflow.

The isolated browser environment does not guarantee external OpenStreetMap tile access; a blank
tile layer in its game capture is a provider/network limitation, while map selection and guess
submission remain covered by browser interaction tests.
