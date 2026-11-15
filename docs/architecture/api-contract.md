# API Contract (preliminary, REST)

Status: approved shape, Phase 0.5. Shape only — not full OpenAPI. All endpoints require TLS in
deployment (R17). No endpoint below is an admin endpoint except the explicitly marked `/admin/*`
routes, which require authentication (decision B.14) — not yet designed in this phase.

## Game lifecycle

- `POST /games` — `{mode: 'solo'|'challenge', difficulty: 'easy'|'medium'|'hard'}` → `{gameId, playerToken}`
- `GET /games/{gameId}` — game + current round summary (requires `playerToken`)

## Rounds (R01/R03/R04/R06/R08)

- `POST /games/{gameId}/rounds` — start next round →
  `{roundId, difficulty, selectionMode: 'map'|'list', candidates?: Location[], weather: {temperatureC, precipitationMm, humidityPct, windSpeedKmh}}`.
  **MUST NOT include actual coordinates** (R04). `candidates` present only in list mode.
- `GET /rounds/{roundId}` — idempotent re-fetch of the same shape.
- `POST /rounds/{roundId}/guess` — final submit `{lat, lon}` →
  `{distanceKm, score, actual: {lat, lon}}` (R09/R10/R11). One guess per round; subsequent
  submits for the same round are rejected (R08's "modify before submit" is enforced client-side
  until this call).

## Results (R11/R18)

- `GET /games/{gameId}/results` — all round results for this game.
- `GET /results/{resultId}` — single result (accessible via `playerToken` ownership, not a
  public listing — decision B.6).

## Async challenges (R16, decision B.3)

- `POST /challenges` — `{roundId}` → `{challengeId, shareUrl}` (creates a shared round other
  players can join).
- `POST /challenges/{challengeId}/entries` — `{resultId}` → joins a completed result to the
  challenge leaderboard.
- `GET /challenges/{challengeId}/leaderboard` — ranked entries, `displayName` only, no account
  data (decision B.6).

## Daily Challenge (ADR-0016)

- `GET /daily/today` — authenticated; returns the shared current UTC date and map round with
  Open-Meteo weather. Actual coordinates are omitted until the caller submits. Reopening after
  completion returns that account's persisted result.
- `POST /daily/today/guess` — authenticated `{lat, lon}`; one submission per user and UTC date,
  enforced by a database unique constraint. Returns distance, score, guess and actual coordinates.
- `GET /daily/{YYYY-MM-DD}/leaderboard?limit=20&offset=0` — authenticated, page size capped at
  100; ranking is score descending, distance ascending, submission time ascending, ID ascending.
  Includes the caller's overall placement even when outside the requested page.

## Admin (decision B.14 — authenticated only, design deferred to Phase 1)

- `POST /admin/locations/refresh` — regenerate/validate the candidate pool.
- `POST /admin/weather/prefetch` — manual trigger of the prefetch job (also runs on schedule,
  §6 of `architecture.md`).

Both require an authenticated admin credential. No anonymous access, no exceptions.

---

**Implementation-ready expansion:** the full, frozen contract (every field, type, status code,
error envelope, headers, and auth per ADR-0009/0011) lives in
`../../agent-handoff/API-CONTRACTS.md`. That document is the authority agents implement against;
this page is the approved high-level shape it expands.
