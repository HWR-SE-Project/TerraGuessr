# TerraGuessr 2.0 feature completion matrix

Status reflects this feature branch as of the Phase 1 slice. Existing R01–R20 evidence remains in [`requirements/traceability-matrix.md`](requirements/traceability-matrix.md).

| Capability | Status | Notes |
|---|---|---|
| Design tokens, TerraGuessr identity, responsive landing | DONE | Phase 1; screenshots in `docs/screenshots/`. |
| Existing Solo game, Easy candidates, map placement, weather, results | DONE | Existing API/state machine preserved; coordinate inputs removed. |
| Persistent signed-in navigation and English/German localization | IN PROGRESS | Signed-in settings/profile/logout navigation and actual English/German landing, dashboard, navigation and account-page text. Statistics/leaderboards links await their real data/API. |
| Google and email authentication, sessions, account recovery | IN PROGRESS | Email registration/login, hashed scrypt passwords, revocable HttpOnly sessions, one-time hashed reset tokens and Google OIDC flow implemented. Google and SMTP end-to-end blocked pending real credentials. |
| Dashboard, profile, settings, statistics, leaderboards | IN PROGRESS | Authenticated solo dashboard, rename, email/provider identity, safe deletion, language and fullscreen settings. Statistics and leaderboards remain unimplemented. |
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
| 2 — Authentication and player dashboard | IN PROGRESS |
| 3 — Game configuration and multiplayer rooms | NOT STARTED |
| 4 — Daily, ranked, statistics and leaderboards | NOT STARTED |
| 5 — Environmental intelligence | NOT STARTED |
| 6 — Final polish and release QA | IN PROGRESS |
