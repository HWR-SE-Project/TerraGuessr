# TerraGuessr 2.0 feature completion matrix

This matrix records the state of the requested product scope on `feature/terraguessr-v2`. “In progress” means a usable slice exists while listed scope remains incomplete.

| Area | Status | Delivered / remaining |
|---|---|---|
| Original visual system and responsive landing/game/results | DONE | Dark TerraGuessr identity, reusable tokens, responsive layouts, structured weather, distinguishable Easy options, map selection, reduced-motion foundation, tutorial and browser screenshots. |
| Existing R01–R20 game | DONE | Preserved and regression-tested. No answer is exposed in a normal round response. |
| Email account lifecycle | DONE | Scrypt password hashing, persistent opaque cookie sessions, registration/login/logout, one-use reset flow when SMTP is configured, profile rename and confirmed deletion. |
| Google sign-in | BLOCKED | OIDC state/nonce/PKCE and ID-token validation are implemented. Requires real Google OAuth client ID, secret, and callback URI; unavailable in this environment and not end-to-end verified. |
| Email recovery delivery | BLOCKED | Reset-token flow is implemented. Requires SMTP URL, sender, and app base URL; no email credentials were supplied. |
| Authenticated dashboard and account foundations | IN PROGRESS | Solo setup and Daily entry are connected; settings/profile, language preference (EN/DE), fullscreen preference, account deletion, and persisted Daily streak display exist. Complete navigation and ranked profile values remain. |
| Solo configuration | IN PROGRESS | Easy/Medium/Hard, map/list, world/continent, optional 2–4 choices, 1–20 rounds, and 1–5 attempts are server-enforced. Intermediate result screens preserve the answer until finish and early finish chooses the best attempt. Country selection, time limits, unlock choices, and advanced intelligence configuration remain. |
| Live multiplayer rooms | NOT STARTED | Existing asynchronous round challenges are preserved. Room creation/join codes, room passwords, synchronized readiness, multi-attempt room play and rematches remain. |
| Ranked matchmaking and progression | NOT STARTED | No server queue, 1v1 match state, countdown, health/damage rules, ranked score changes or ranked leaderboard. |
| Daily Challenge | IN PROGRESS | Shared persisted UTC-day challenge, one account submission, answer protection, scoring, result reload, paginated/highlighted date-selectable leaderboard with personal placement, profile current/longest streaks, and daily score/distance history are implemented. Historical challenge replay remains. |
| Environmental intelligence beyond base weather | IN PROGRESS | Open-Meteo provides nullable pressure, wind direction, UV index, daily sunshine duration and local time, with one-hour cache, attribution, optional-unavailable UI and documented free-endpoint restrictions. Aviation, pollution, earthquakes, sun position and unlock costs are absent. No paid API is enabled. |
| Panoramic location imagery | NOT STARTED | A blurred non-location-specific visual fallback is present. No imagery provider has been activated; Google Street View licensing/cost study and provider integration remain. |
| Solo and Daily results | IN PROGRESS | Solo round/final results and Daily score/distance/location/placement are connected. Polished per-mode history/result maps, daily streak and date results remain. |
| Statistics and leaderboards | IN PROGRESS | Paginated account-owned Solo/asynchronous challenge/Daily history, per-mode averages, expandable actual/guess details, date-selectable paginated Daily leaderboard, personal placement and current-player highlight are implemented. Ranked remains explicitly unavailable; historical daily selection and richer maps remain. |
| Settings audio | NOT STARTED | There is no application audio playback, so functional sound-effect/music controls are not exposed. |
| Tutorial/legal information | IN PROGRESS | Interactive game tutorial exists; complete legal and external-provider information pages remain. |
| Testing and accessibility QA | IN PROGRESS | Backend unit/integration suites, frontend unit suite and full Playwright suite pass. Full keyboard/screen-reader audit, mobile/tablet coverage across all flows, provider-failure UI, and browser testing with reachable map tiles remain. |

## External configuration blockers

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- Password recovery delivery: `SMTP_URL`, `SMTP_FROM`, and `APP_BASE_URL`.
- No paid data/image APIs are required by implemented functionality or have been activated.
