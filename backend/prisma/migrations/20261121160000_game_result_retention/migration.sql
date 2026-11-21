-- R18: durable, account-associated round archive with 6-month retention.
--
-- The previous StreetResult table only covered anonymous singleplayer rounds.
-- Rename it to GameResult, add the player/mode/session columns, and relax the
-- guess/distance columns so a completed round without a submitted guess can
-- still be archived with score 0.

CREATE TYPE "GameMode" AS ENUM ('solo', 'multiplayer');

ALTER TABLE "StreetResult" RENAME TO "GameResult";
ALTER TABLE "GameResult" RENAME CONSTRAINT "StreetResult_pkey" TO "GameResult_pkey";
ALTER INDEX "StreetResult_createdAt_idx" RENAME TO "GameResult_createdAt_idx";

-- Carry legacy solo rows forward: their gameId becomes sessionId and the
-- legacy roundId unique key is replaced by the deterministic `id` dedupe key.
ALTER TABLE "GameResult" ADD COLUMN "userId" TEXT,
ADD COLUMN "mode" "GameMode" NOT NULL DEFAULT 'solo',
ADD COLUMN "sessionId" TEXT;

ALTER TABLE "GameResult" ALTER COLUMN "mode" DROP DEFAULT;

UPDATE "GameResult" SET "sessionId" = "gameId" WHERE "sessionId" IS NULL;
ALTER TABLE "GameResult" ALTER COLUMN "sessionId" SET NOT NULL;

ALTER TABLE "GameResult" ALTER COLUMN "guessLat" DROP NOT NULL;
ALTER TABLE "GameResult" ALTER COLUMN "guessLon" DROP NOT NULL;
ALTER TABLE "GameResult" ALTER COLUMN "distanceKm" DROP NOT NULL;

DROP INDEX "StreetResult_roundId_key";
ALTER TABLE "GameResult" DROP COLUMN "gameId", DROP COLUMN "roundId";

-- Account association for new archives, plus the live-session side that stores
-- the player's id once at creation/join. SET NULL keeps retained rows when an
-- account is deleted; the retention job still removes them after 6 months.
ALTER TABLE "StreetGame" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "LobbyMember" ADD COLUMN "userId" TEXT;

CREATE INDEX "GameResult_userId_createdAt_idx" ON "GameResult"("userId", "createdAt");
CREATE INDEX "GameResult_sessionId_idx" ON "GameResult"("sessionId");
CREATE INDEX "StreetGame_ownerUserId_idx" ON "StreetGame"("ownerUserId");
CREATE INDEX "LobbyMember_userId_idx" ON "LobbyMember"("userId");

ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StreetGame" ADD CONSTRAINT "StreetGame_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
