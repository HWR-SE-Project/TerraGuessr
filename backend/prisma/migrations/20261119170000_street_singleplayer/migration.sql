CREATE TABLE "StreetGame" (
  "id" TEXT NOT NULL, "playerTokenHash" TEXT NOT NULL,
  "roundsTotal" INTEGER NOT NULL DEFAULT 5, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreetGame_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StreetRound" (
  "id" TEXT NOT NULL, "gameId" TEXT NOT NULL, "number" INTEGER NOT NULL,
  "panoId" TEXT NOT NULL, "targetIndex" INTEGER NOT NULL,
  "targetLat" DOUBLE PRECISION NOT NULL, "targetLon" DOUBLE PRECISION NOT NULL,
  "guessLat" DOUBLE PRECISION, "guessLon" DOUBLE PRECISION,
  "distanceKm" DOUBLE PRECISION, "score" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreetRound_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StreetGame_expiresAt_idx" ON "StreetGame"("expiresAt");
CREATE UNIQUE INDEX "StreetRound_gameId_number_key" ON "StreetRound"("gameId", "number");
ALTER TABLE "StreetRound" ADD CONSTRAINT "StreetRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "StreetGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
