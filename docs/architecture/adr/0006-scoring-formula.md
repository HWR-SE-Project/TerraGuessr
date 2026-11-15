# ADR-0006: Scoring formula

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14) — initial proposal, to be validated
with tests per the Product Owner's instruction.

## Context
R10 requires a score based on distance between guess and actual location; Phase 0 flagged the
formula as completely unspecified ("closer = more points" is not testable).

## Decision
`score = round(5000 * exp(-distanceKm / 2000))`, maximum 5000 points per round, deterministic
and monotonically decreasing in distance.

## Properties (for the test suite — decision B.1 asks this be tested)
- `distanceKm = 0` → `score = 5000` (maximum).
- Monotonically decreasing: larger distance never yields a higher score.
- Asymptotic toward 0 as distance grows; never negative (`exp(...)` is always positive, `round`
  can floor it to 0 at large distances — confirm the exact cutoff in the test suite).
- Deterministic: same input always yields the same output (no randomness).

## Consequences
This formula is a Product-Owner-supplied initial proposal, not independently derived from a
requirement — R10 only requires *a* monotonic distance-based formula. Backend test suite
(Vitest) must assert the properties above before this is considered implemented, per the
Product Owner's explicit instruction to "propose and test."
