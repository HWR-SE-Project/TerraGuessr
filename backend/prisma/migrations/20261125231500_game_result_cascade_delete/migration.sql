-- Immediately delete archived statistics (`GameResult`) when a user deletes
-- their account, and remove any previously orphaned (anonymized) rows.

DELETE FROM "GameResult" WHERE "userId" IS NULL;

ALTER TABLE "GameResult" DROP CONSTRAINT "GameResult_userId_fkey";
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
