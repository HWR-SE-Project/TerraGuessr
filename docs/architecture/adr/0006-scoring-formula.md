# ADR-0006: Scoring formula

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14) — initial proposal, to be validated
with tests per the Product Owner's instruction.

> **Superseded (2026-11-21):** the exponential formula below did not satisfy R10's explicit
> boundary values ("up to 100 km → 5000", "at least 20,000 km → 0"). The implemented formula is
> a linear decay applied to the R9-rounded distance, documented here and in
> `backend/src/domain/scoring.ts`.

## Context
R10 requires a score based on distance between guess and actual location; Phase 0 flagged the
formula as completely unspecified ("closer = more points" is not testable). R10 later fixed the
boundary values.

## Decision
`score = floor(5000 × (20000 − distanceKm) / 19900)`, computed on the R9-rounded (one-decimal)
distance, with `5000` for `distanceKm ≤ 100` and `0` for `distanceKm ≥ 20000`. Maximum 5000
points per round, deterministic and monotonically non-increasing in distance.

## Properties (for the test suite — decision B.1 asks this be tested)
- `distanceKm ≤ 100` → `score = 5000` (maximum; boundary applies to the R9-rounded distance).
- `distanceKm ≥ 20000` → `score = 0`.
- Monotonically non-increasing: larger distance never yields a higher score.
- Integer in `[0, 5000]`.
- Deterministic: same input always yields the same output (no randomness).

## Consequences
This formula satisfies R10's boundary values and monotonicity. Backend test suite (Vitest) must
assert the properties above, per the Product Owner's explicit instruction to "propose and test."

