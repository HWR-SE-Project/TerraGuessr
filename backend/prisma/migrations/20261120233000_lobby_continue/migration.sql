-- Post-match decision: players choose to continue (rematch) or leave. A null
-- `continueRequestedAt` past the 30-second window means auto-removal.
ALTER TABLE "LobbyMember" ADD COLUMN "continueRequestedAt" TIMESTAMP(3);
