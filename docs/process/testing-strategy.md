# Testing Strategy

Status: Phase 0.5 — approved tooling, strategy to be executed in Phase 1.

## Tools (approved, section A)
- **Vitest** — unit and integration tests (backend logic, scoring/distance functions, API route
  handlers against a test database).
- **Playwright** — end-to-end tests (full game loop through the actual UI).

## What must be tested before an epic is considered done

- **Scoring (ADR-0006):** property-based assertions — `distanceKm = 0 → score = 5000`,
  monotonically decreasing, deterministic, never negative. This is an explicit Product Owner
  instruction ("propose and test"), not optional.
- **R04 (hide actual location):** a regression test asserting the round-start response never
  contains the actual coordinates in any field, including nested/raw payloads.
- **R13 (fallback on weather failure):** test that a simulated Open-Meteo failure triggers
  bounded retries then a location replacement, never a crash or a location served without
  mandatory fields.
- **R18 purge job:** test that results older than 6 months are deleted and results within the
  window are not.
- **Admin endpoints (decision B.14):** test that every `/admin/*` route rejects unauthenticated
  requests.
- **Async challenge (R16/ADR-0005):** test that a challenge's leaderboard only contains entries
  for the challenge's fixed round/location.

## Process

Every PR requires passing CI (Vitest + Playwright, see `.github/workflows/ci.yml`) and an
independent QA review before merge (see `git-workflow.md`). The `qa` agent owns writing and
maintaining acceptance-criteria-level tests per epic as it lands — not just checking developer-
written tests after the fact.
