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
type SelectionMode = 'map' | 'list';

interface WeatherDTO {              // R03/R06 — four required metrics plus optional provider metrics
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  airPressureHpa: number | null;    // Open-Meteo surface pressure in hPa
  windDirectionDeg: number | null;  // 10 m direction, degrees clockwise from north
  uvIndex: number | null;
  sunshineDurationSeconds: number | null;
  localTime: string | null;         // provider-local ISO 8601 current time
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

## 4. Account statistics and leaderboards

### `GET /api/statistics?mode=solo|multiplayer|ranked&limit=20&offset=0`
Cookie-authenticated account history, paginated to 100 rows maximum.
- **200:** `{ mode, available, entries, total, offset, limit, averageScore, averageDistanceKm }`. Each
  completed entry includes date, round number, actual/guess coordinates, score, distance, and
  result timestamp. `solo`, `multiplayer` and `ranked` return
  `{ available: false, entries: [], total: 0 }` until account-linked results exist.
- Errors: `401 UNAUTHORIZED`; `400 VALIDATION_ERROR`.

### `GET /api/leaderboards/ranked`
Cookie-authenticated. Returns `503 SERVICE_UNAVAILABLE` until the real ranked queue and ratings
are implemented; the API does not fabricate rows.

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
