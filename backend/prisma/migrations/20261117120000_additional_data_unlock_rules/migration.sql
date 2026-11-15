CREATE TYPE "AdditionalDataUnlockMode" AS ENUM ('immediate', 'time', 'points');

ALTER TABLE "Game"
  ADD COLUMN "additionalDataUnlockMode" "AdditionalDataUnlockMode" NOT NULL DEFAULT 'immediate',
  ADD COLUMN "additionalDataUnlockCost" INTEGER;

ALTER TABLE "Round"
  ADD COLUMN "additionalDataAvailableAt" TIMESTAMP(3),
  ADD COLUMN "additionalDataUnlockedAt" TIMESTAMP(3),
  ADD COLUMN "additionalDataPointsSpent" INTEGER NOT NULL DEFAULT 0;

-- Existing games retain immediate access, preserving their established behavior.
