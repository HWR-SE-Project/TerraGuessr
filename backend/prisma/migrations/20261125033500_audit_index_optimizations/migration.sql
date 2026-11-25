-- Step 6 (M-3): Add missing FK/query indexes and drop 5 redundant prefix
-- B-tree indexes already covered by existing UNIQUE constraints.

-- Missing indexes for member ON DELETE CASCADE, auth cleanup, and /api/me/results grouping.
CREATE INDEX "EmailChangeRequest_completedAt_idx" ON "EmailChangeRequest"("completedAt");
CREATE INDEX "LobbyRoundAttempt_memberId_idx" ON "LobbyRoundAttempt"("memberId");
CREATE INDEX "LobbyRoundResult_memberId_idx" ON "LobbyRoundResult"("memberId");
CREATE INDEX "GameResult_userId_matchId_createdAt_idx" ON "GameResult"("userId", "matchId", "createdAt");

-- Redundant prefix indexes duplicating leading columns of UNIQUE constraints.
DROP INDEX IF EXISTS "LobbyMember_lobbyId_idx";
DROP INDEX IF EXISTS "LobbyRound_lobbyId_idx";
DROP INDEX IF EXISTS "LobbyRoundAttempt_roundId_memberId_idx";
DROP INDEX IF EXISTS "LobbyRoundResult_roundId_idx";
DROP INDEX IF EXISTS "StreetRoundAttempt_roundId_idx";
