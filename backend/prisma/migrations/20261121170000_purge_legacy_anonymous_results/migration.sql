-- R18 guest-rule cleanup: the archive is only for results associated with a
-- signed-in player. Every row present at this point came from the legacy
-- anonymous StreetResult table and received a NULL userId in the preceding
-- migration, so remove those rows rather than retaining them for six months.
DELETE FROM "GameResult" WHERE "userId" IS NULL;
