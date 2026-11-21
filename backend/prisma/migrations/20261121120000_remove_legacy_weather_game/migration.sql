-- Remove the legacy weather-expedition and asynchronous duel data model.
-- Singleplayer uses StreetGame/StreetRound/StreetResult and multiplayer uses
-- the Lobby* tables, so these tables no longer back any API route.

DROP TABLE IF EXISTS "ChallengeEntry" CASCADE;
DROP TABLE IF EXISTS "Challenge" CASCADE;
DROP TABLE IF EXISTS "Result" CASCADE;
DROP TABLE IF EXISTS "RoundAttempt" CASCADE;
DROP TABLE IF EXISTS "Guess" CASCADE;
DROP TABLE IF EXISTS "Round" CASCADE;
DROP TABLE IF EXISTS "Game" CASCADE;

DROP TYPE IF EXISTS "GameMode";
DROP TYPE IF EXISTS "GameStatus";
DROP TYPE IF EXISTS "RoundStatus";
DROP TYPE IF EXISTS "AdditionalDataUnlockMode";
