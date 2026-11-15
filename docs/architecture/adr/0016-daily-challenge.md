# ADR-0016: Persist one shared Daily Challenge per UTC day

Status: Accepted

## Decision

The API derives the challenge date from UTC (`YYYY-MM-DD`). For each date it pins one location from the ordered land-location pool using FNV-1a(date) modulo the pool length, then persists that location and its fetched weather snapshot in `DailyChallenge`. The first successful initialization fixes the challenge for that date across application instances. If weather cannot be fetched, the endpoint returns 503 and does not publish a partial challenge.

Each authenticated account may create one `DailySubmission` per date. A database unique constraint on `(date, userId)` is the authoritative repeat guard, including concurrent submissions. Results use the existing Haversine distance and exponential score curve. Ranking is score descending, distance ascending, submission time ascending, then id ascending. The API returns actual coordinates only after that account has submitted. Leaderboard pagination is capped at 100 rows and the caller's global rank is calculated separately.

Daily challenges reference weather snapshots and locations with `RESTRICT`, preserving source data used by historical daily results. The daily submissions and challenges are removed when their account or challenge is explicitly deleted according to the foreign-key policy; production cleanup must retain challenge dependencies until historical result retention expires.

## Consequences

- UTC midnight is the only day boundary; client timezone does not affect selection or eligibility.
- The location pool is shared by all application instances, so deterministic selection requires the pool contents and ordering to be consistent. Persisting the row freezes the chosen location if the pool later changes.
- Open-Meteo is the existing free weather source; no paid provider or live third-party account is required. A weather outage blocks challenge initialization without substituting fabricated values.
- Streaks are derived from persisted submission dates; they are not yet exposed in the player profile.
