-- R16: pre-game multiplayer waiting room. Additive only — no existing table
-- is altered. A lobby stores membership plus the host's difficulty; round
-- generation remains out of scope.

CREATE TYPE "LobbyStatus" AS ENUM ('waiting', 'playing', 'finished');

CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "hostTokenHash" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "roundsTotal" INTEGER NOT NULL DEFAULT 5,
    "status" "LobbyStatus" NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LobbyMember" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "playerTokenHash" TEXT NOT NULL,
    "displayName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lobby_code_key" ON "Lobby"("code");
CREATE INDEX "Lobby_expiresAt_idx" ON "Lobby"("expiresAt");
CREATE INDEX "Lobby_status_idx" ON "Lobby"("status");

CREATE UNIQUE INDEX "LobbyMember_lobbyId_playerTokenHash_key" ON "LobbyMember"("lobbyId", "playerTokenHash");
CREATE INDEX "LobbyMember_lobbyId_idx" ON "LobbyMember"("lobbyId");

ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
