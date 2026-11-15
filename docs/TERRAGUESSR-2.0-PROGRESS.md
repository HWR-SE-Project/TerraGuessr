# TerraGuessr 2.0 progress

Work is on the recoverable `feature/terraguessr-v2` branch. The preserved R01–R20 release requirements remain traced in `requirements/traceability-matrix.md`.

| Phase | Status | Evidence / notes |
|---|---|---|
| 1. Design system and existing-game UX | DONE | Dark design system, original identity, responsive landing, immersive game shell, structured weather HUD, distinguishable Easy candidates, map confirmation, results and tutorial styling. Vitest, typecheck, lint, build, desktop/mobile Playwright and screenshot review passed. |
| 2. Authentication and player dashboard | NOT STARTED | Existing application uses anonymous per-game player tokens; no account/session system is present. |
| 3. Configuration and live multiplayer rooms | NOT STARTED | Existing multiplayer is an asynchronous shared-location challenge, not a live room. |
| 4. Daily, ranked, statistics and leaderboards | NOT STARTED | No ranked or daily account progression exists in the current schema. |
| 5. Extended environmental intelligence | NOT STARTED | Only Open-Meteo base fields exist. Paid providers are not authorized. |
| 6. Accessibility, responsive and final QA | NOT STARTED | Phase 1 introduces reduced-motion and responsive foundations; full audit remains. |

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
- Playwright: 3 passing (desktop candidate round, 375px mobile no-overflow, map marker and confirmation interaction).
- Screenshots reviewed at 1440px and 375px. No raw coordinate fields or duplicate Easy labels; map and candidate submission are functional.

## Baseline

- Frontend: 39 tests passed.
- Backend unit suite: 154 tests passed.
- Repository `main` was fetched and verified at `edb18d3` before branching.
