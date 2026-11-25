-- Add R04-safe 3D biome diorama scene metadata to singleplayer and lobby rounds.
ALTER TABLE "StreetRound" ADD COLUMN "sceneJson" JSONB;
ALTER TABLE "LobbyRound" ADD COLUMN "sceneJson" JSONB;
