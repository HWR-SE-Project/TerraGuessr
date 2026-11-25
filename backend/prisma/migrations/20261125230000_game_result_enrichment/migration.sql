-- Enrich GameResult with nullable round context and completed-match multiplayer placement.
-- Existing archived rows remain valid with NULLs and degrade gracefully in statistics/history.

ALTER TABLE "GameResult"
  ADD COLUMN "placeName" TEXT,
  ADD COLUMN "biome" TEXT,
  ADD COLUMN "weather" TEXT,
  ADD COLUMN "temperatureBand" TEXT,
  ADD COLUMN "attemptsUsed" INTEGER,
  ADD COLUMN "extraDataUnlocked" BOOLEAN,
  ADD COLUMN "extraDataPointsSpent" INTEGER,
  ADD COLUMN "elapsedSeconds" INTEGER,
  ADD COLUMN "matchPlacement" INTEGER,
  ADD COLUMN "matchPlayerCount" INTEGER;
