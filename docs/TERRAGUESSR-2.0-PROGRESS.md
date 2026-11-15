# TerraGuessr 2.0 progress

Work is on the recoverable `feature/terraguessr-v2` branch. The preserved R01–R20 release requirements remain traced in `requirements/traceability-matrix.md`.

| Phase | Status | Evidence / notes |
|---|---|---|
| 1. Design system and existing-game UX | DONE | Dark design system, original identity, responsive landing, immersive game shell, structured weather HUD, distinguishable Easy candidates, map confirmation, results and tutorial styling. Vitest, typecheck, lint, build, desktop/mobile Playwright and screenshot review passed. |
| 2. Authentication and player dashboard | IN PROGRESS | Additive users/sessions/preferences/reset-token schema; scrypt email auth, opaque HttpOnly cookie sessions, profile/settings, language preference and authenticated solo dashboard are wired. SMTP and Google remain disabled until configured; profile/stat history and full account-navigation scope continue later. Integration tests pass on isolated PostgreSQL; browser verification is running. |
| 3. Configuration and live multiplayer rooms | NOT STARTED | Existing multiplayer is an asynchronous shared-location challenge, not a live room. |
| 4. Daily, ranked, statistics and leaderboards | NOT STARTED | No ranked or daily account progression exists in the current schema. |
| 5. Extended environmental intelligence | NOT STARTED | Only Open-Meteo base fields exist. Paid providers are not authorized. |
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
- Backend integration suite: 24 passed, including registration/login/logout, hashed session storage, password reset single-use/session revocation, CSRF rejection, preferences, deletion re-authentication and game-owner anonymization. Existing backend unit suite: 154 passed; frontend unit suite: 40 passed; both typecheck/lint/build passed.
- Production dependency audit (`npm audit --omit=dev`): zero known vulnerabilities. Google and SMTP end-to-end remain blocked until valid external credentials are supplied.
- Account flow passed a real browser registration/settings/localization/account-deletion scenario at desktop and mobile widths. Full regression E2E against a fresh isolated Docker Compose stack: 18/18 passed, including all preserved R01–R20 browser flows.
