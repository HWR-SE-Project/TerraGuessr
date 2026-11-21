-- R18: a lobby can host multiple matches (rematches). matchId identifies one
-- exact match, so archived rounds can be grouped even when sessionId (the
-- lobby id) is reused.
ALTER TABLE "Lobby" ADD COLUMN "matchId" TEXT;
UPDATE "Lobby" SET "matchId" = "id" WHERE "matchId" IS NULL;
ALTER TABLE "Lobby" ALTER COLUMN "matchId" SET NOT NULL;

ALTER TABLE "GameResult" ADD COLUMN "matchId" TEXT;
UPDATE "GameResult" SET "matchId" = "sessionId" WHERE "matchId" IS NULL;
ALTER TABLE "GameResult" ALTER COLUMN "matchId" SET NOT NULL;

CREATE INDEX "GameResult_matchId_idx" ON "GameResult"("matchId");
