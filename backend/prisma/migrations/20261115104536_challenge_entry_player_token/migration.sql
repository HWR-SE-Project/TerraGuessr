-- P0-3: a ChallengeEntry now records which player token created it, so a
-- player can be limited to one entry per challenge regardless of which
-- result they submit. Added with a temporary default so it is safe to apply
-- against a table that already has rows (pre-launch, likely none), then the
-- default is dropped so every future insert must supply the hash explicitly
-- (matches the Prisma schema, which declares no @default for this column).
ALTER TABLE "ChallengeEntry" ADD COLUMN "playerTokenHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChallengeEntry" ALTER COLUMN "playerTokenHash" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_playerTokenHash_key" ON "ChallengeEntry"("challengeId", "playerTokenHash");
