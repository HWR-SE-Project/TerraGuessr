# API-CONTRACTS.md — Frozen REST contract (authoritative)

Status: **frozen** (Principal Architect, Phase 1, 2026-11-14). This is the single source of truth
for every request/response shape. Backend implements it as TypeBox schemas
(`backend/src/contracts/`); frontend mirrors it in `frontend/src/api/types.ts` (ADR-0010). Any
change here is a contract change and requires an orchestrator-coordinated update on both sides.

## Conventions
- Base path: all routes under `/api` (frontend reaches them via `VITE_API_BASE_URL`).
- Content type: `application/json; charset=utf-8`.
- **Player auth** (ADR-0011): owned resources require header `X-Player-Token: <raw token>`.
  Ownership failure ⇒ `404 NOT_FOUND` (never reveal existence).
- **Admin auth** (ADR-0011): `/api/admin/*` requires `Authorization: Bearer <ADMIN_API_TOKEN>` ⇒
  else `401 UNAUTHORIZED`.
- **Error envelope** (ADR-0009), every non-2xx:
  `{ "error": { "code": string, "message": string, "details"?: object } }`.
- All coordinates: WGS84 decimal degrees, `lat ∈ [-90,90]`, `lon ∈ [-180,180]`.
- IDs: opaque strings (cuid). Timestamps: ISO-8601 UTC strings.

## Shared DTOs

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode   = 'solo' | 'challenge';
type SelectionMode = 'map' | 'list';

interface WeatherDTO {              // R03/R06 — exactly these four, always present
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
}
interface CandidateDTO {            // list mode only; NEVER reveals which one is actual (R04)
  id: string;
  name: string | null;
  lat: number;                      // candidate coords are allowed — they are the player's options
  lon: number;
  region: string;
}
interface LatLon { lat: number; lon: number; }
interface ErrorDTO { error: { code: string; message: string; details?: Record<string, unknown> }; }
```

---

## 1. Games

### `POST /api/games`
Create a game. No auth.
- **Body:** `{ mode: GameMode; difficulty: Difficulty; roundsTotal?: number; geography?: 'world'|Region; candidateCount?: 2|3|4 }`; solo accepts 1–20 rounds (default 5), a world/continent pool, and optional list sizes. Challenge is always one shared round.
- **201:** `{ gameId: string; playerToken: string; roundsTotal: number }` — `playerToken` returned **once**; client
  stores it and sends it as `X-Player-Token` thereafter (ADR-0011).
- Errors: `400 VALIDATION_ERROR`.

### `GET /api/games/{gameId}`
Game summary. Auth: `X-Player-Token`.
- **200:**
  ```ts
  { gameId: string; mode: GameMode; difficulty: Difficulty;
    status: 'active'|'completed'; roundsPlayed: number; roundsTotal: number;
    currentRound: { roundId: string; roundNumber: number; status: 'active'|'completed' } | null }
  ```
- Errors: `404 NOT_FOUND`.

---

## 2. Rounds (R01/R03/R04/R06/R07/R08)

### `POST /api/games/{gameId}/rounds`
Start the next round. Auth: `X-Player-Token`.
- **Body:** `{ selectionMode?: SelectionMode }` — honored only for Medium (ADR-0008); ignored for
  Easy (forced `list`) and Hard (forced `map`).
- **201:**
  ```ts
  { roundId: string; roundNumber: number; difficulty: Difficulty;
    selectionMode: SelectionMode;
    weather: WeatherDTO;
    candidates?: CandidateDTO[] }      // present iff selectionMode === 'list'
  ```
  **MUST NOT contain the actual location coordinates in any field** (R04). In `list` mode the
  actual is one of `candidates` but is not flagged.
- Errors: `404 NOT_FOUND`; `409 CONFLICT` (active round exists / game completed / round cap
  reached); `503 SERVICE_UNAVAILABLE` (no location with complete weather after R13 fallback).

### `GET /api/rounds/{roundId}`
Idempotent re-fetch of the same shape as the `POST` 201 (minus re-running selection). Auth:
`X-Player-Token`. Same R04 guarantee. Errors: `404 NOT_FOUND`.

### `POST /api/rounds/{roundId}/guess` (R08/R09/R10/R11)
Final submit. Auth: `X-Player-Token`. One per round.
- **Body:** `{ lat: number; lon: number }`
- **200:** `{ distanceKm: number; score: number; actual: LatLon; resultId: string }` — reveal
  happens **only here** (R11).
- Errors: `404 NOT_FOUND`; `409 CONFLICT` (round not active / already guessed); `400
  VALIDATION_ERROR` (coords out of range).

---

## 3. Results (R11/R18)

### `GET /api/games/{gameId}/results`
Auth: `X-Player-Token`.
- **200:** `{ results: ResultDTO[]; totalScore: number }` where
  ```ts
  interface ResultDTO { resultId: string; roundNumber: number;
    distanceKm: number; score: number; actual: LatLon; guess: LatLon; createdAt: string; }
  ```
- Errors: `404 NOT_FOUND`.

### `GET /api/results/{resultId}`
Auth: `X-Player-Token` (must own the parent game). **200:** `ResultDTO`. Errors: `404 NOT_FOUND`.

---

## 4. Async challenges (R16, ADR-0005)

### `POST /api/challenges`
Create a shared challenge from an existing round. Auth: `X-Player-Token` (must own the round).
- **Body:** `{ roundId: string }`
- **201:** `{ challengeId: string; shareUrl: string }`
- Errors: `404 NOT_FOUND`; `400 VALIDATION_ERROR`.

### `POST /api/challenges/{challengeId}/entries`
Attach a completed result (for the challenge's fixed round) to the leaderboard. Auth:
`X-Player-Token` (must own the result).
- **Body:** `{ resultId: string; displayName?: string }`  (`displayName` ≤ 40 chars, no PII)
- **201:** `{ entryId: string; rank: number }`
- Errors: `404 NOT_FOUND`; `409 CONFLICT` (result is not for this challenge's round, or already
  entered); `400 VALIDATION_ERROR`.

### `GET /api/challenges/{challengeId}/leaderboard`
**Public, no auth** (B.6).
- **200:**
  ```ts
  { challengeId: string;
    entries: { rank: number; displayName: string | null; score: number; distanceKm: number }[] }
  ```
  Entries are only for this challenge's fixed round/location (tested — TESTING-CHECKLIST R16).
- Errors: `404 NOT_FOUND`.

---

## 5. Admin (B.14, ADR-0011) — `Authorization: Bearer` required

### `POST /api/admin/locations/refresh` → `202 { jobId: string }`
Regenerate/validate the candidate pool (re-runs the seed logic).

### `POST /api/admin/weather/prefetch` → `202 { warmed: number }`
Warm `WeatherSnapshot` cache across the pool.

Both: `401 UNAUTHORIZED` if the bearer is missing/invalid. No anonymous access, ever.

---

## 6. Health

### `GET /api/health` → `200 { status: 'ok'; time: string }` (no auth; for compose/CI readiness).
