# TerraGuessr 2.0 progress

Work is on the recoverable `feature/terraguessr-v2` branch. The preserved R01–R20 release requirements remain traced in `requirements/traceability-matrix.md`.

| Phase | Status | Evidence / notes |
|---|---|---|
| 1. Design system and existing-game UX | DONE | Dark design system, original identity, responsive landing, immersive game shell, structured weather HUD, distinguishable Easy candidates, map confirmation, results and tutorial styling. Vitest, typecheck, lint, build, desktop/mobile Playwright and screenshot review passed. |
| 2. Authentication and player dashboard | IN PROGRESS | Additive users/sessions/preferences/reset-token schema; scrypt email auth, opaque HttpOnly cookie sessions, profile/settings, language preference and authenticated solo dashboard are wired. Email account flows and profile streak display pass browser checks. SMTP and Google remain disabled until configured; ranked profile values and full account-navigation scope continue later. |
| 3. Configuration and live multiplayer rooms | IN PROGRESS | Solo setup persists and enforces 1–20 rounds, 1–5 attempts, difficulty/map-list controls, optional geography and candidate count. Live rooms and remaining custom rules remain unimplemented. Existing async challenges remain unchanged. |
| 4. Daily, ranked, statistics and leaderboards | IN PROGRESS | Daily Challenge has UTC-pinned shared locations, one server-enforced submission per account, persisted scoring, paginated/highlighted leaderboard, current/longest streaks and Daily history. Paginated Solo/asynchronous challenge stats and averages are connected. Ranked matchmaking/ratings and historical daily selection remain. |
| 5. Extended environmental intelligence | IN PROGRESS | Open-Meteo pressure, 10 m wind direction, UV index, sunshine duration and local time are optional snapshot metrics with attribution. Aviation, pollution, earthquakes, sun position and imagery remain unimplemented; provider terms/costs must be reviewed before those integrations. |
| 6. Accessibility, responsive and final QA | IN PROGRESS | Responsive layouts and reduced-motion foundations exist; Phase 2 auth controls were browser-checked at 375px, but a full accessibility/security audit remains. |

## Phase 1 implementation notes

- The UI keeps the current API and round state machine; no correct-answer field was introduced.
- Null candidate names are rendered as geographic grid sectors derived from candidate coordinates. Duplicate labels receive a neutral sector suffix.
- Ordinary game play has no latitude/longitude inputs. Map clicks and candidate cards feed the same existing `{lat, lon}` submission contract.
- Panoramic background is a stylized, deliberately blurred generic fallback; no imagery provider is activated.
- Sound controls are omitted because the application has no sound playback behavior yet.
- Evidence screenshots are stored in [`screenshots`](screenshots/): desktop and 375px mobile landing/game views plus desktop map play.

## Phase 1 verification

- Frontend Vitest: 40 passing.
- Frontend typecheck, lint and production build: passed.
- Backend unit tests: 154 passing; backend typecheck, lint and build: passed.
- Backend integration tests against isolated PostgreSQL: 20 passing.
- Playwright: 3 passing (desktop candidate round, 375px mobile no-overflow, map marker and confirmation interaction).
- Full Playwright E2E suite against a clean isolated Docker Compose stack: 17 passing (including R04 network checks, weather fallback, async multiplayer challenge, and round/map flows).
- Screenshots reviewed at 1440px and 375px. No raw coordinate fields or duplicate Easy labels; map and candidate submission are functional.

## Baseline

- Frontend: 39 tests passed.
- Backend unit suite: 154 tests passed.
- Repository `main` was fetched and verified at `edb18d3` before branching.

## Phase 2 progress

- Existing guests and per-game player tokens are preserved; authenticated new games record an optional account owner. Account deletion cascades identity/session/preferences and anonymizes retained game ownership using `ON DELETE SET NULL`.
- Passwords use Node scrypt (N=2^17, r=8, p=1); sessions and password-reset tokens are random, with only token hashes stored. Reset tokens are single-use and revoke existing sessions.
- Google OIDC uses state, nonce, S256 PKCE, and the official Google auth library's ID-token signature/audience validation. It is shown as unavailable without real client configuration.
- SMTP recovery has generic responses and is available only when `SMTP_URL`, `SMTP_FROM`, and `APP_BASE_URL` are configured. No provider credentials exist in this branch.
- Email account registration/login, session inspection/logout, profile rename, deletion confirmation/re-authentication, preferences, settings fullscreen, German/English landing/dashboard/navigation and account-page labels are connected.
- Backend integration suite: 27 passed, including registration/login/logout, hashed session storage, password reset single-use/session revocation, CSRF rejection, preferences, deletion re-authentication, game-owner anonymization, configurable round bounds, continent scoping and candidate counts. Existing backend unit suite: 154 passed; frontend unit suite: 40 passed; both typecheck/lint/build passed.
- Production dependency audit (`npm audit --omit=dev`): zero known vulnerabilities. Google and SMTP end-to-end remain blocked until valid external credentials are supplied.
- Account flow passed a real browser registration/settings/localization/account-deletion scenario at desktop and mobile widths. Full regression E2E against a fresh isolated Docker Compose stack: 18/18 passed, including all preserved R01–R20 browser flows.

## Phase 3 progress

- Added the additive `Game.roundsTotal` database field with a default of five, preserving existing sessions and API callers.
- API creation validates solo counts 1–20, optional continent scope, and optional 2–4 candidate lists. The values are persisted and enforced by server round selection, prefetch, candidate reconstruction, round cap and final-game completion. Async challenges remain one shared round.
- Added a dedicated responsive setup view with solo mode, existing difficulty/map-list choices, continent/world selection, optional list-size customization, and an accessible 1–20 round slider. Settings survive retry and drive the actual game.
- Integration tests cover 1, 2, invalid round values (0, 1.5, 21), completed-game state, cap enforcement, Asia-only locations, three distinct candidates and hidden answer protection. Browser test covers setup, one-round completion and responsive layout; screenshot captured on mobile.
- Country scope remains unavailable because seeded locations do not contain verified country identifiers. Duration timer, unlock costs and live room configuration remain NOT STARTED; no UI implies they are operational.
- Full browser regression suite against isolated Docker Compose after Phase 3: 19/19 passed. This includes account flows, Asia-scoped three-choice one-round solo completion, preserved guest play, and existing async challenges. The 390px setup screenshot was reviewed; no horizontal overflow or duplicated difficulty heading remains.
- Multi-attempt follow-up (ADR-0017): additive `Game.attemptsPerRound` and `RoundAttempt` schema; 1–5 server validation; per-round attempt persistence; transaction row locking for attempt/finish races; intermediate score/distance responses that omit actual coordinates; finish-early selects the best persisted guess; last allowed attempt finalizes automatically. Existing one-attempt API remains compatible and is rejected for custom multi-attempt games.
- Setup now offers 1–5 attempts and the gameplay header shows current/allowed attempts. Playwright exercises two list attempts and verifies the answer stays hidden until round completion; its 390px mobile intermediate-result screenshot was reviewed for overflow. Integration tests cover 1/5 bounds, early finish, best-attempt selection, final-attempt auto-finish, hidden intermediate answer, and blocking the old single-submit endpoint. Backend integration: 31/31; complete Playwright regression: 20/20.

## Phase 4 progress

- Added `DailyChallenge` and `DailySubmission` through an additive migration. The UTC date boundary is explicit; location choice is stable over the ordered land-location pool and persisted with the selected Open-Meteo snapshot. A failed weather request returns service unavailable without inventing data.
- Authenticated `/api/daily/today` hides actual coordinates until submission. `/guess` enforces one attempt per user/date in PostgreSQL and applies the existing distance/score rules. `/leaderboard` uses score, distance, timestamp, and ID tie-breaks, supports bounded pagination, and calculates the current player's global position.
- Connected an authenticated Dashboard Daily Challenge tile and existing map-based game surface, including completed-result reload and leaderboard view. Added ADR-0016 documenting UTC, selection, ranking, data retention, and outage behavior.
- Added UTC-derived current and longest Daily streak calculations to the authenticated profile. Streaks use saved account submissions and do not assume a streak from a challenge not yet played.
- Added authenticated Statistics and Leaderboard navigation. Statistics returns paginated persisted Solo, asynchronous challenge, and Daily results with average score/distance and clickable actual/guess details. Daily leaderboard supports date selection, page navigation, personal placement and current-player highlighting. Ranked views explain unavailability; they do not show fabricated rows.
- Phase 4 is still IN PROGRESS: ranked matchmaking/progression, historical Daily challenge replay, ranked standings, and multiplayer rematches are not implemented.
- Current verification after Daily, attempts, statistics, streak and weather follow-ups: backend unit suite 159 passed; frontend unit suite 42 passed; backend and frontend typecheck/lint/build passed; backend integration suite 33/33 passed; full Playwright suite 20/20 passed, including authenticated Daily, date-selected leaderboard, account statistics, multi-attempt Solo, and required/optional weather fields. Desktop and 375px mobile game screenshots were captured and reviewed. OpenStreetMap tiles loaded in the latest full-stack browser run; tile availability can vary with external network access.

## Phase 5 progress

- Extended the Open-Meteo provider request with surface pressure (hPa), 10 m wind direction (degrees clockwise from north), UV index, daily sunshine duration (seconds, shown in hours), and provider-local time using `timezone=auto`. These fields are nullable and optional; missing optional values do not reject the four required R03 weather metrics or block a game.
- Added nullable database columns through additive migrations. Existing snapshots remain valid. Round and Daily weather contracts include explicit nullable values; the HUD renders unavailable values as an em dash and links to provider attribution. UV/sunshine/local time sit in a collapsed, expandable HUD panel.
- Documented provider coverage limits, one-hour TerraGuessr cache freshness, units, attribution/license, and the free endpoint's non-commercial use restriction in `docs/architecture/environmental-data-sources.md`. No paid provider was activated.
- Added Open-Meteo parsing tests for present and unavailable optional data; the deterministic fake provider includes the optional metrics. Frontend component tests verify unavailable states, attribution, sunshine conversion and compact local-time formatting. Backend unit 159/159, frontend unit 42/42, backend integration 33/33, and the full Playwright suite 20/20 passed. Prisma validation, both typecheck/lint/build pipelines, and desktop/mobile HUD screenshot review passed.
