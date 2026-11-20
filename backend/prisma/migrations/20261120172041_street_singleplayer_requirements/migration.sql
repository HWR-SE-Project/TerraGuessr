-- Street View singleplayer: difficulty (R05), next-round prefetch cache (R12),
-- easy-mode candidate list (R07), and durable result archive (R18).
--
-- Note: pre-existing single-column expiresAt/lastUsedAt indexes on the auth
-- tables (added by 20261120150000_auth_hardening, used by
-- scheduler/authCleanup.ts's unscoped cleanup queries) are intentionally left
-- untouched here; they were missing from schema.prisma and have been restored
-- as explicit @@index declarations rather than dropped.

-- AlterTable
ALTER TABLE "StreetGame" ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
ADD COLUMN     "nextPanoId" TEXT,
ADD COLUMN     "nextTargetIndex" INTEGER,
ADD COLUMN     "nextTargetLat" DOUBLE PRECISION,
ADD COLUMN     "nextTargetLon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StreetRound" ADD COLUMN     "candidatesJson" JSONB;

-- CreateTable
CREATE TABLE "StreetResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "actualLat" DOUBLE PRECISION NOT NULL,
    "actualLon" DOUBLE PRECISION NOT NULL,
    "guessLat" DOUBLE PRECISION NOT NULL,
    "guessLon" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreetResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreetResult_roundId_key" ON "StreetResult"("roundId");

-- CreateIndex
CREATE INDEX "StreetResult_createdAt_idx" ON "StreetResult"("createdAt");
