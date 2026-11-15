-- Optional Open-Meteo solar/daylight measurements; old snapshots stay valid.
ALTER TABLE "WeatherSnapshot"
  ADD COLUMN "uvIndex" DOUBLE PRECISION,
  ADD COLUMN "sunshineDurationSeconds" DOUBLE PRECISION,
  ADD COLUMN "localTime" TEXT;
