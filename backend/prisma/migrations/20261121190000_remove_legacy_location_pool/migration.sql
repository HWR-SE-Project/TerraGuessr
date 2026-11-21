-- Remove the legacy Natural Earth location pool and its weather-snapshot cache.
--
-- The live Street View flow selects from ROAD_TARGETS and fetches weather via
-- the intelligence provider (Open-Meteo), so neither table is read by any API
-- route. This also drops the enums that only existed to type those tables.

DROP TABLE IF EXISTS "WeatherSnapshot" CASCADE;
DROP TABLE IF EXISTS "Location" CASCADE;

DROP TYPE IF EXISTS "LocationSrc";
DROP TYPE IF EXISTS "WeatherSrc";
DROP TYPE IF EXISTS "Region";
