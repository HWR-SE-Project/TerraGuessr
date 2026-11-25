-- Add persistent preparation record & R13 3-location weather budget tracking
-- for both singleplayer (StreetGame) and multiplayer (LobbyRound).

ALTER TABLE "StreetGame"
  ADD COLUMN "nextRoundNumber" INTEGER,
  ADD COLUMN "nextSceneJson" JSONB,
  ADD COLUMN "nextWeatherValidUntil" TIMESTAMP(3),
  ADD COLUMN "nextAttemptedIndices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "nextExhausted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LobbyRound"
  ADD COLUMN "weatherAttemptedIndices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "weatherExhausted" BOOLEAN NOT NULL DEFAULT false;
