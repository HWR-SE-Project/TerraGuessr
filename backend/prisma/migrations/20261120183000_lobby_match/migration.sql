ALTER TABLE "Lobby"
  ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3);

ALTER TABLE "LobbyMember"
  ADD COLUMN "selectionLat" DOUBLE PRECISION,
  ADD COLUMN "selectionLon" DOUBLE PRECISION;

CREATE TABLE "LobbyRound" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "panoId" TEXT NOT NULL,
    "targetIndex" INTEGER NOT NULL,
    "targetLat" DOUBLE PRECISION NOT NULL,
    "targetLon" DOUBLE PRECISION NOT NULL,
    "candidatesJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LobbyRoundAttempt" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "guessLat" DOUBLE PRECISION NOT NULL,
    "guessLon" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyRoundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LobbyRoundResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "guessLat" DOUBLE PRECISION,
    "guessLon" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "score" INTEGER NOT NULL,
    "attemptsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyRoundResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LobbyRound_lobbyId_number_key" ON "LobbyRound"("lobbyId", "number");
CREATE INDEX "LobbyRound_lobbyId_idx" ON "LobbyRound"("lobbyId");
CREATE UNIQUE INDEX "LobbyRoundAttempt_roundId_memberId_attemptNumber_key" ON "LobbyRoundAttempt"("roundId", "memberId", "attemptNumber");
CREATE INDEX "LobbyRoundAttempt_roundId_memberId_idx" ON "LobbyRoundAttempt"("roundId", "memberId");
CREATE UNIQUE INDEX "LobbyRoundResult_roundId_memberId_key" ON "LobbyRoundResult"("roundId", "memberId");
CREATE INDEX "LobbyRoundResult_roundId_idx" ON "LobbyRoundResult"("roundId");

ALTER TABLE "LobbyRound" ADD CONSTRAINT "LobbyRound_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LobbyRoundAttempt" ADD CONSTRAINT "LobbyRoundAttempt_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LobbyRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LobbyRoundAttempt" ADD CONSTRAINT "LobbyRoundAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LobbyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LobbyRoundResult" ADD CONSTRAINT "LobbyRoundResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LobbyRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LobbyRoundResult" ADD CONSTRAINT "LobbyRoundResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LobbyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
