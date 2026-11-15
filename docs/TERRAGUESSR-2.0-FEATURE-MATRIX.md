# TerraGuessr 2.0 feature completion matrix

Status reflects this feature branch as of the Phase 1 slice. Existing R01–R20 evidence remains in [`requirements/traceability-matrix.md`](requirements/traceability-matrix.md).

| Capability | Status | Notes |
|---|---|---|
| Design tokens, TerraGuessr identity, responsive landing | DONE | Phase 1; screenshots in `docs/screenshots/`. |
| Existing Solo game, Easy candidates, map placement, weather, results | DONE | Existing API/state machine preserved; coordinate inputs removed. |
| Persistent signed-in navigation and English/German localization | NOT STARTED | No signed-in identity or localization system exists yet. |
| Google and email authentication, sessions, account recovery | NOT STARTED | No user or session schema/routes exist. Requires Google OAuth client settings and an email delivery provider for safe recovery. |
| Dashboard, profile, settings, statistics, leaderboards | NOT STARTED | No persisted user profile/preferences or ranked progression. |
| Game setup, custom rules, live multiplayer rooms | NOT STARTED | Current challenge is asynchronous and remains preserved. |
| Ranked 1v1 and matchmaking | NOT STARTED | No ranked match state or scoring policy implemented. |
| Daily challenge and streaks | NOT STARTED | No UTC challenge schedule or account-linked participation data. |
| Additional environment/aviation/earthquake data | NOT STARTED | Current weather API supplies the existing four fields only. No paid API enabled. |
| Panorama imagery provider | NOT STARTED | Generic blurred CSS fallback is present; no image API or billing activated. |
| Accessibility, security and full-stack release QA | IN PROGRESS | Phase 1 focus states, semantic controls, reduced motion, responsive browser checks; broader audit remains. |

## Current external configuration blockers

- Google sign-in needs OAuth client ID/secret and an authorized callback URI, supplied through environment configuration.
- Email account recovery needs an authorized transactional email provider and sender configuration. No credential has been invented or added.
- No extra-data or street imagery API is enabled. Provider licensing, coverage, freshness, terms and pricing need evaluation before selection; paid integrations need separate authorization.

## Phase status

| Phase | Status |
|---|---|
| 1 — Product design system and existing-game UX | DONE |
| 2 — Authentication and player dashboard | NOT STARTED |
| 3 — Game configuration and multiplayer rooms | NOT STARTED |
| 4 — Daily, ranked, statistics and leaderboards | NOT STARTED |
| 5 — Environmental intelligence | NOT STARTED |
| 6 — Final polish and release QA | IN PROGRESS |
