# ADR-0002: REST, not GraphQL

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
All data access patterns in R01–R20 are known, fixed shapes (start a round, submit a guess, get
a result, get a leaderboard) — not ad-hoc client-driven queries.

## Decision
REST/JSON API, documented in `../api-contract.md`.

## Rationale
GraphQL's flexibility solves a problem this project doesn't have (varied, client-specific query
shapes) and costs setup/schema complexity for no benefit here.

## Consequences
Adding a genuinely different client (e.g. a future mobile app with different data needs) is the
only scenario that would revisit this — not applicable in this release.
