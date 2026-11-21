-- R05/R16: per-player additional-data unlock and per-player hard-mode deadline.
-- Previously these lived on the shared LobbyRound, so one player's unlock paid
-- for (and revealed data to) everyone.

CREATE TABLE "LobbyRoundMemberState" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "extraDataUnlockedAt" TIMESTAMP(3),
    "extraDataPointsSpent" INTEGER NOT NULL DEFAULT 0,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyRoundMemberState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LobbyRoundMemberState_roundId_memberId_key"
  ON "LobbyRoundMemberState"("roundId", "memberId");
CREATE INDEX "LobbyRoundMemberState_roundId_idx"
  ON "LobbyRoundMemberState"("roundId");
CREATE INDEX "LobbyRoundMemberState_memberId_idx"
  ON "LobbyRoundMemberState"("memberId");

ALTER TABLE "LobbyRoundMemberState"
  ADD CONSTRAINT "LobbyRoundMemberState_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "LobbyRound"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LobbyRoundMemberState"
  ADD CONSTRAINT "LobbyRoundMemberState_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "LobbyMember"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LobbyRoundResult"
  ADD COLUMN "extraDataPointsSpent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "LobbyRound"
  DROP COLUMN "additionalDataUnlockedAt",
  DROP COLUMN "additionalDataPointsSpent";
