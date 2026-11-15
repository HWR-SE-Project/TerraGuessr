CREATE TABLE "DailyChallenge" (
  "date" VARCHAR(10) NOT NULL,
  "locationId" TEXT NOT NULL,
  "weatherSnapshotId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "DailySubmission" (
  "id" TEXT NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "userId" TEXT NOT NULL,
  "guessLat" DOUBLE PRECISION NOT NULL,
  "guessLon" DOUBLE PRECISION NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailySubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailySubmission_date_userId_key" ON "DailySubmission"("date", "userId");
CREATE INDEX "DailySubmission_date_score_distanceKm_idx" ON "DailySubmission"("date", "score", "distanceKm");
CREATE INDEX "DailySubmission_userId_date_idx" ON "DailySubmission"("userId", "date");

ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_weatherSnapshotId_fkey"
  FOREIGN KEY ("weatherSnapshotId") REFERENCES "WeatherSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_date_fkey"
  FOREIGN KEY ("date") REFERENCES "DailyChallenge"("date") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
