# API Contract (preliminary, REST)

Status: approved shape, Phase 0.5. Shape only — not full OpenAPI. All endpoints require TLS in
deployment (R17). No endpoint below is an admin endpoint except the explicitly marked `/admin/*`
routes, which require authentication (decision B.14) — not yet designed in this phase.

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

## Player statistics and leaderboards

- `GET /statistics?mode=solo|multiplayer|ranked&limit=20&offset=0` — authenticated,
  paginated persisted history and per-mode average score/distance. `multiplayer` currently reports
  completed account-owned asynchronous challenge games. Ranked returns `available: false` until
  the server-ranked mode exists.
- `GET /leaderboards/ranked` — authenticated; returns 503 until real ranked ratings exist.

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
