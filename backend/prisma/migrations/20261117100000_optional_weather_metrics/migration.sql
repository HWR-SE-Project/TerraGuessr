-- Optional Open-Meteo measurements; existing snapshots remain valid.
ALTER TABLE "WeatherSnapshot"
  ADD COLUMN "airPressureHpa" DOUBLE PRECISION,
  ADD COLUMN "windDirectionDeg" DOUBLE PRECISION;
