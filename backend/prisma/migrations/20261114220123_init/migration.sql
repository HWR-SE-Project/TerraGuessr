-- CreateEnum
CREATE TYPE "Region" AS ENUM ('AFRICA', 'EUROPE', 'ASIA', 'NORTH_AMERICA', 'SOUTH_AMERICA', 'OCEANIA');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('solo', 'challenge');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('active', 'completed');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('active', 'completed');

-- CreateEnum
CREATE TYPE "LocationSrc" AS ENUM ('grid', 'city');

-- CreateEnum
CREATE TYPE "WeatherSrc" AS ENUM ('open_meteo');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "region" "Region" NOT NULL,
    "isLand" BOOLEAN NOT NULL DEFAULT true,
    "source" "LocationSrc" NOT NULL DEFAULT 'grid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "precipitationMm" DOUBLE PRECISION NOT NULL,
    "humidityPct" DOUBLE PRECISION NOT NULL,
    "windSpeedKmh" DOUBLE PRECISION NOT NULL,
    "extra" JSONB,
    "source" "WeatherSrc" NOT NULL DEFAULT 'open_meteo',

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'active',
    "playerTokenHash" TEXT NOT NULL,
    "nextLocationId" TEXT,
    "nextWeatherSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "weatherSnapshotId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "selectionMode" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "actualLat" DOUBLE PRECISION NOT NULL,
    "actualLon" DOUBLE PRECISION NOT NULL,
    "guessLat" DOUBLE PRECISION NOT NULL,
    "guessLon" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_region_idx" ON "Location"("region");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_locationId_fetchedAt_idx" ON "WeatherSnapshot"("locationId", "fetchedAt");

-- CreateIndex
CREATE INDEX "Game_playerTokenHash_idx" ON "Game"("playerTokenHash");

-- CreateIndex
CREATE INDEX "Round_gameId_status_idx" ON "Round"("gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_roundNumber_key" ON "Round"("gameId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_roundId_key" ON "Guess"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_roundId_key" ON "Result"("roundId");

-- CreateIndex
CREATE INDEX "Result_createdAt_idx" ON "Result"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_roundId_key" ON "Challenge"("roundId");

-- CreateIndex
CREATE INDEX "ChallengeEntry_challengeId_idx" ON "ChallengeEntry"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_resultId_key" ON "ChallengeEntry"("challengeId", "resultId");

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_weatherSnapshotId_fkey" FOREIGN KEY ("weatherSnapshotId") REFERENCES "WeatherSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_round_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
