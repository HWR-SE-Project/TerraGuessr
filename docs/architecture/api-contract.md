# API Contract (preliminary, REST)

Status: approved shape, Phase 0.5. Shape only — not full OpenAPI. All endpoints require TLS in
deployment (R17). No endpoint below is an admin endpoint except the explicitly marked `/admin/*`
routes, which require authentication (decision B.14) — not yet designed in this phase.

## Game lifecycle

- `POST /games` — `{mode, difficulty, roundsTotal?, geography?, candidateCount?, attemptsPerRound?}` → `{gameId, playerToken, roundsTotal, attemptsPerRound}`. Solo accepts 1–5 attempts (default 1); challenge stays at one.
- `GET /games/{gameId}` — game + current round summary (requires `playerToken`)

## Rounds (R01/R03/R04/R06/R08)

- `POST /games/{gameId}/rounds` — start next round →
  `{roundId, attemptsTotal, difficulty, selectionMode: 'map'|'list', candidates?: Location[], weather: {temperatureC, precipitationMm, humidityPct, windSpeedKmh, airPressureHpa: number|null, windDirectionDeg: number|null, uvIndex: number|null, sunshineDurationSeconds: number|null, localTime: string|null}}`.
  **MUST NOT include actual coordinates** (R04). `candidates` present only in list mode.
- `GET /rounds/{roundId}` — idempotent re-fetch of the same shape.
- `POST /rounds/{roundId}/guess` — final submit `{lat, lon}` →
  `{distanceKm, score, actual: {lat, lon}}` (R09/R10/R11). One guess per round; subsequent
  submits for the same round are rejected (R08's "modify before submit" is enforced client-side
  until this call).
- `POST /rounds/{roundId}/attempts` and `/finish` — configured multi-attempt workflow. Intermediate
  submissions return distance and score only; the best persisted attempt is selected at finish and
  the actual location is revealed only in the final result. Database constraints and row locking
  enforce the attempt limit under concurrent requests.

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

## Lobbies (R16, live shared rounds)

A lobby is membership plus the host's difficulty and round count. Once the host starts the
match, the server generates shared Street View rounds; every member receives the same panorama,
candidates and difficulty rules, while guesses and scores remain per player.

- `POST /lobbies` — `{difficulty, roundsTotal?, displayName?}` → 201 `{lobby, lobbyToken}`. The
  creator is the host. Difficulty is `easy|medium|hard`; R5 rules (time limit, attempts,
  selection mode) are derived from it. `roundsTotal` is an integer from 3 to 10 and defaults to
  5. The lobby expires after 2 hours.
- `GET /lobbies/{code}` — public lobby view `{lobbyId, code, difficulty, status,
  roundsTotal, rules, members, youAreHost, createdAt, expiresAt}`. Polled every ~3s. An optional
  `X-Lobby-Token` sets `youAreHost`. Expired lobbies return `404 NOT_FOUND`.
- `POST /lobbies/{code}/join` — `{displayName?}` → 201 `{lobby, lobbyToken}`. Issues a fresh
  lobby token (ADR-0011). `409 CONFLICT` when no longer `waiting`.
- `POST /lobbies/{code}/leave` — auth `X-Lobby-Token`; 204. A guest is removed from the lobby
  (with their match history). A host leaving before the match starts disbands the lobby (cascades
  members); after the match starts the host is removed and the earliest remaining player becomes
  host, so the game continues.
- `DELETE /lobbies/{code}` — auth `X-Lobby-Token`; 204. Host only; a non-host member gets
  `403 FORBIDDEN`, an unknown token `404 NOT_FOUND`.
- `POST /lobbies/{code}/start` — host only; generates all shared rounds and switches the lobby to
  `playing`.
- `GET /lobbies/{code}/match` — poll the active round, your attempts/result and the shared
  leaderboard. The actual location stays hidden until you finish the round. A finalized result
  carries a `guesses` list with every participant who has submitted, so their map markers (and,
  in easy mode, the candidate city they picked) can be shown once you are allowed to see results.
- `POST /lobbies/{code}/selection` — save the current pin without consuming an attempt.
- `POST /lobbies/{code}/rounds/{roundNumber}/guess` — submit an attempt (`final` finishes early);
  intermediate attempts never reveal the actual location or score.
- `POST /lobbies/{code}/rounds/{roundNumber}/finish` — lock in the best submitted attempt.
- `GET /lobbies/{code}/rounds/{roundNumber}/intelligence` — environmental clues for the active
  shared round.

Lobby tokens are scoped per code and stored client-side separately from the game `playerToken`.

## Daily Challenge (ADR-0016)

- `GET /daily/today` — authenticated; returns the shared current UTC date and map round with
  Open-Meteo weather. Actual coordinates are omitted until the caller submits. Reopening after
  completion returns that account's persisted result.
- `POST /daily/today/guess` — authenticated `{lat, lon}`; one submission per user and UTC date,
  enforced by a database unique constraint. Returns distance, score, guess and actual coordinates.
- `GET /daily/{YYYY-MM-DD}/leaderboard?limit=20&offset=0` — authenticated, page size capped at
  100; ranking is score descending, distance ascending, submission time ascending, ID ascending.
  Includes the caller's overall placement even when outside the requested page.

## Player statistics and leaderboards

- `GET /statistics?mode=solo|multiplayer|ranked|daily&limit=20&offset=0` — authenticated,
  paginated persisted history and per-mode average score/distance. `multiplayer` currently reports
  completed account-owned asynchronous challenge games. Ranked returns `available: false` until
  the server-ranked mode exists.
- `GET /leaderboards/ranked` — authenticated; returns 503 until real ranked ratings exist.
- Daily history/standings use `/statistics?mode=daily` and `/daily/{date}/leaderboard`.

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
