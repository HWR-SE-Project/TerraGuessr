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

Guest play continues to use the anonymous per-game player token (decision B.6).
TerraGuessr 2.0 ADR-0013 adds optional `User`, `AuthSession`,
`PasswordResetToken`, and `UserPreference` records. New authenticated games may
store nullable `ownerUserId`; account deletion sets it to null while R18 result
retention remains unchanged. See [ADR-0013](adr/0013-account-sessions.md).

---

## Finalized Prisma schema (Phase 1 authoritative)

Status: **authoritative** for implementation (Principal Architect, Phase 1 finalization,
2026-11-14). This is the exact schema the `data-engineer` seeds against and the `backend`
implements. Field additions vs. the preliminary shape above: `Game.playerTokenHash` (ADR-0011),
`Game.nextLocationId` / `Game.nextWeatherSnapshotId` (prefetch, R12 — see `architecture.md` §6a),
explicit enums, indexes, and FK rules.

```prisma
// backend/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Region      { AFRICA EUROPE ASIA NORTH_AMERICA SOUTH_AMERICA OCEANIA }
enum GameMode     { solo challenge }
enum Difficulty   { easy medium hard }
enum GameStatus   { active completed }
enum RoundStatus  { active completed }
enum LocationSrc  { grid city }
enum WeatherSrc   { open_meteo }

model Location {
  id         String       @id @default(cuid())
  lat        Float
  lon        Float
  name       String?
  region     Region
  isLand     Boolean      @default(true)
  source     LocationSrc  @default(grid)
  createdAt  DateTime     @default(now())
  snapshots  WeatherSnapshot[]
  rounds     Round[]
  @@index([region])
}

model WeatherSnapshot {
  id              String      @id @default(cuid())
  locationId      String
  location        Location    @relation(fields: [locationId], references: [id], onDelete: Cascade)
  fetchedAt       DateTime    @default(now())
  temperatureC    Float       // R03 mandatory
  precipitationMm Float       // R03 mandatory
  humidityPct     Float       // R03 mandatory
  windSpeedKmh    Float       // R03 mandatory
  extra           Json?       // decision B.2: optional, never required
  source          WeatherSrc  @default(open_meteo)
  rounds          Round[]
  @@index([locationId, fetchedAt])   // drives ≤1h staleness lookup (B.11)
}

model Game {
  id                    String      @id @default(cuid())
  mode                  GameMode
  difficulty            Difficulty
  status                GameStatus  @default(active)
  playerTokenHash       String                        // sha256(rawToken), ADR-0011
  nextLocationId        String?                       // prefetched next round (R12)
  nextWeatherSnapshotId String?
  createdAt             DateTime    @default(now())
  rounds                Round[]
  @@index([playerTokenHash])
}

model Round {
  id                String           @id @default(cuid())
  gameId            String
  game              Game             @relation(fields: [gameId], references: [id], onDelete: Cascade)
  locationId        String
  location          Location         @relation(fields: [locationId], references: [id])
  weatherSnapshotId String
  weatherSnapshot   WeatherSnapshot  @relation(fields: [weatherSnapshotId], references: [id])
  roundNumber       Int
  difficulty        Difficulty
  selectionMode     String           // 'map' | 'list'
  status            RoundStatus      @default(active)
  startedAt         DateTime         @default(now())
  completedAt       DateTime?
  guess             Guess?
  result            Result?
  @@unique([gameId, roundNumber])
  @@index([gameId, status])
}

model Guess {
  id          String   @id @default(cuid())
  roundId     String   @unique                     // one guess per round (R08)
  round       Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  lat         Float
  lon         Float
  submittedAt DateTime @default(now())
}

model Result {
  id         String   @id @default(cuid())
  roundId    String   @unique
  round      Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  actualLat  Float
  actualLon  Float
  guessLat   Float
  guessLon   Float
  distanceKm Float    // R09
  score      Int      // R10
  createdAt  DateTime @default(now())               // drives 6-month purge (R18)
  entries    ChallengeEntry[]
  @@index([createdAt])                              // purge scan
}

model Challenge {
  id        String   @id @default(cuid())
  roundId   String                                   // the shared fixed round/location (B.3)
  round     Round    @relation(fields: [roundId], references: [id], map: "Challenge_round_fkey")
  createdAt DateTime @default(now())
  expiresAt DateTime?
  entries   ChallengeEntry[]
}

model ChallengeEntry {
  id          String    @id @default(cuid())
  challengeId String
  challenge   Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  resultId    String
  result      Result    @relation(fields: [resultId], references: [id], onDelete: Cascade)
  displayName String?                                // no account (B.6)
  @@unique([challengeId, resultId])
  @@index([challengeId])
}
```

> Note: `Round.location` has **no cascade delete** — purging a `Result` (R18) must never cascade
> into deleting pool `Location`s. The purge job deletes `Result` rows only (and leaves `Round`
> history or purges it explicitly per the retention policy; see TESTING-CHECKLIST R18 case).
> The `Challenge.round` relation adds a second `Round`→... FK path, hence the explicit relation
> `map` name to keep Prisma's referential-action inference unambiguous.
