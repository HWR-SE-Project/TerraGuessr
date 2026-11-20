-- Lobbies no longer impose a player cap; remove the unused column.
ALTER TABLE "Lobby" DROP COLUMN "maxPlayers";
