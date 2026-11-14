# Data Model (preliminary)

Status: approved shape, Phase 0.5. Implementation (Prisma schema) happens in Phase 1.

## Entities

### `Location`
Candidate game location, pre-validated and pool-seeded (R01/R02).
- `id`, `lat`, `lon`, `name?`, `region` (for difficulty scoping, §4 of architecture.md)
- `isLand: boolean` — pre-validated against the land mask
- `source: 'grid' | 'city'`
- `createdAt`

### `WeatherSnapshot`
Cached weather for a location (R03/R06/R12).
- `id`, `locationId` (FK → Location)
- `fetchedAt` — drives the ≤1h staleness check (decision B.11)
- `temperatureC`, `precipitationMm`, `humidityPct`, `windSpeedKmh` — mandatory (R03)
- `extra?: jsonb` — optional additional fields (decision B.2: optional indicators allowed but never required)
- `source`

### `Game`
- `id`, `mode: 'solo' | 'challenge'`, `difficulty: 'easy' | 'medium' | 'hard'`
- `playerToken?` — opaque client-held token, not a user account (decision B.6)
- `status`, `createdAt`

### `Round`
Holds the authoritative actual location server-side (R01/R04/R11/R12/R13).
- `id`, `gameId` (FK), `locationId` (FK), `roundNumber`, `difficulty`
- `weatherSnapshotId` (FK)
- `status: 'active' | 'completed'`, `startedAt`, `completedAt`

### `Guess`
Final submitted tip (R08 — modification before submit is client-side state; only the final
value is persisted).
- `id`, `roundId` (FK), `lat`, `lon`, `submittedAt`

### `Result`
- `id`, `roundId` (FK)
- `actualLat`, `actualLon`, `guessLat`, `guessLon`
- `distanceKm`, `score` (R09/R10)
- `createdAt` — drives the 6-month retention purge (R18, decision B.6)

### `Challenge` (R16, async shared mode — decision B.3)
- `id`, `roundId` (FK, the shared round/location), `createdAt`, `expiresAt?`

### `ChallengeEntry`
- `id`, `challengeId` (FK), `resultId` (FK), `displayName?` (no account required — decision B.6)

No `User`/`Player` account entity in this release — anonymous play only (decision B.6).
Introducing accounts is an explicit future decision, not assumed.
