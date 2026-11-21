-- R02/R05/R08: shared round lifecycle fields for singleplayer and lobbies.

ALTER TABLE "StreetRound"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "selectionLat" DOUBLE PRECISION,
  ADD COLUMN "selectionLon" DOUBLE PRECISION,
  ADD COLUMN "additionalDataUnlockedAt" TIMESTAMP(3),
  ADD COLUMN "additionalDataPointsSpent" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "StreetRound_endsAt_idx" ON "StreetRound"("endsAt");

CREATE TABLE "StreetRoundAttempt" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "guessLat" DOUBLE PRECISION NOT NULL,
  "guessLon" DOUBLE PRECISION NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreetRoundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreetRoundAttempt_roundId_attemptNumber_key"
  ON "StreetRoundAttempt"("roundId", "attemptNumber");
CREATE INDEX "StreetRoundAttempt_roundId_idx" ON "StreetRoundAttempt"("roundId");

ALTER TABLE "StreetRoundAttempt"
  ADD CONSTRAINT "StreetRoundAttempt_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "StreetRound"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LobbyRound"
  ADD COLUMN "additionalDataUnlockedAt" TIMESTAMP(3),
  ADD COLUMN "additionalDataPointsSpent" INTEGER NOT NULL DEFAULT 0;
