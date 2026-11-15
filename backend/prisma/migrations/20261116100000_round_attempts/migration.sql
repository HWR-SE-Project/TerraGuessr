ALTER TABLE "Game"
  ADD COLUMN "attemptsPerRound" INTEGER NOT NULL DEFAULT 1
  CHECK ("attemptsPerRound" BETWEEN 1 AND 5);

CREATE TABLE "RoundAttempt" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "guessLat" DOUBLE PRECISION NOT NULL,
  "guessLon" DOUBLE PRECISION NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoundAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoundAttempt_roundId_attemptNumber_key" ON "RoundAttempt"("roundId", "attemptNumber");
CREATE INDEX "RoundAttempt_roundId_score_distanceKm_idx" ON "RoundAttempt"("roundId", "score", "distanceKm");
ALTER TABLE "RoundAttempt" ADD CONSTRAINT "RoundAttempt_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
