-- Optional finite round limit for singleplayer sessions (null = endless mode).
-- Uses the same 3..10 range as multiplayer lobbies so round counts stay consistent.
ALTER TABLE "StreetGame" ADD COLUMN "roundsTotal" INTEGER;
