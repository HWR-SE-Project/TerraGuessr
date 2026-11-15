ALTER TABLE "Game"
    ADD COLUMN "geoRegion" "Region",
    ADD COLUMN "candidateCount" INTEGER
    CHECK ("candidateCount" IS NULL OR "candidateCount" BETWEEN 2 AND 4);
