-- Endless Singleplayer: there is no fixed round limit any more, so the
-- gameplay cap that used to live on the session row is gone. It was never
-- read by scoring, auditing, or the durable StreetResult archive (R18) —
-- only by the now-removed "All rounds are completed" check in routes.ts —
-- so dropping it loses no historical or scoring data.
ALTER TABLE "StreetGame" DROP COLUMN "roundsTotal";
