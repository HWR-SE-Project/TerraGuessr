-- Preserve location identity (R11) across the biome-diorama catalog expansion.
-- Adds an explicit `placeName` column to StreetRound and LobbyRound, and
-- remaps pre-diorama rows (where `sceneJson IS NULL` and `targetIndex` used the
-- original 30-city index order) to their true city names and new catalog indices
-- verified by coordinates.

ALTER TABLE "StreetRound" ADD COLUMN "placeName" TEXT;
ALTER TABLE "LobbyRound" ADD COLUMN "placeName" TEXT;

WITH legacy_map(old_idx, new_idx, name, lat, lon) AS (
  VALUES
    (0,   0,   'London',        51.5009,   -0.1246),
    (1,   1,   'Paris',         48.8530,    2.3499),
    (2,   4,   'Rome',          41.8902,   12.4923),
    (3,   3,   'Madrid',        40.4168,   -3.7038),
    (4,   104, 'Amsterdam',     52.3702,    4.8952),
    (5,   44,  'Oslo',          59.9139,   10.7522),
    (6,   103, 'Copenhagen',    55.6761,   12.5683),
    (7,   60,  'Zürich',        47.3769,    8.5417),
    (8,   100, 'Lisbon',        38.7223,   -9.1393),
    (9,   5,   'Prague',        50.0875,   14.4213),
    (10,  7,   'Tokyo',         35.6595,  139.7005),
    (11,  8,   'Seoul',         37.5665,  126.9780),
    (12,  115, 'Singapore',      1.2868,  103.8545),
    (13,  9,   'Bangkok',       13.7563,  100.5018),
    (14,  116, 'Taipei',        25.0330,  121.5654),
    (15,  106, 'Sydney',       -33.8688,  151.2093),
    (16,  18,  'Melbourne',    -37.8136,  144.9631),
    (17,  107, 'Auckland',     -36.8485,  174.7633),
    (18,  12,  'New York',      40.7580,  -73.9855),
    (19,  110, 'San Francisco', 37.7955, -122.3937),
    (20,  14,  'Toronto',       43.6532,  -79.3832),
    (21,  40,  'Vancouver',     49.2827, -123.1207),
    (22,  15,  'Mexico City',   19.4326,  -99.1332),
    (23,  76,  'Bogotá',         4.5981,  -74.0758),
    (24,  17,  'Buenos Aires', -34.6037,  -58.3816),
    (25,  77,  'Santiago',     -33.4489,  -70.6693),
    (26,  16,  'São Paulo',    -23.5505,  -46.6333),
    (27,  118, 'Cape Town',    -33.9249,   18.4241),
    (28,  120, 'Nairobi',       -1.2864,   36.8172),
    (29,  19,  'Lagos',          6.5244,    3.3792)
)
UPDATE "StreetRound" AS r
SET "targetIndex" = m.new_idx,
    "placeName"   = m.name
FROM legacy_map AS m
WHERE r."sceneJson" IS NULL
  AND r."placeName" IS NULL
  AND r."targetIndex" = m.old_idx
  AND ABS(r."targetLat" - m.lat) < 0.35
  AND ABS(r."targetLon" - m.lon) < 0.35;

WITH legacy_map(old_idx, new_idx, name, lat, lon) AS (
  VALUES
    (0,   0,   'London',        51.5009,   -0.1246),
    (1,   1,   'Paris',         48.8530,    2.3499),
    (2,   4,   'Rome',          41.8902,   12.4923),
    (3,   3,   'Madrid',        40.4168,   -3.7038),
    (4,   104, 'Amsterdam',     52.3702,    4.8952),
    (5,   44,  'Oslo',          59.9139,   10.7522),
    (6,   103, 'Copenhagen',    55.6761,   12.5683),
    (7,   60,  'Zürich',        47.3769,    8.5417),
    (8,   100, 'Lisbon',        38.7223,   -9.1393),
    (9,   5,   'Prague',        50.0875,   14.4213),
    (10,  7,   'Tokyo',         35.6595,  139.7005),
    (11,  8,   'Seoul',         37.5665,  126.9780),
    (12,  115, 'Singapore',      1.2868,  103.8545),
    (13,  9,   'Bangkok',       13.7563,  100.5018),
    (14,  116, 'Taipei',        25.0330,  121.5654),
    (15,  106, 'Sydney',       -33.8688,  151.2093),
    (16,  18,  'Melbourne',    -37.8136,  144.9631),
    (17,  107, 'Auckland',     -36.8485,  174.7633),
    (18,  12,  'New York',      40.7580,  -73.9855),
    (19,  110, 'San Francisco', 37.7955, -122.3937),
    (20,  14,  'Toronto',       43.6532,  -79.3832),
    (21,  40,  'Vancouver',     49.2827, -123.1207),
    (22,  15,  'Mexico City',   19.4326,  -99.1332),
    (23,  76,  'Bogotá',         4.5981,  -74.0758),
    (24,  17,  'Buenos Aires', -34.6037,  -58.3816),
    (25,  77,  'Santiago',     -33.4489,  -70.6693),
    (26,  16,  'São Paulo',    -23.5505,  -46.6333),
    (27,  118, 'Cape Town',    -33.9249,   18.4241),
    (28,  120, 'Nairobi',       -1.2864,   36.8172),
    (29,  19,  'Lagos',          6.5244,    3.3792)
)
UPDATE "LobbyRound" AS r
SET "targetIndex" = m.new_idx,
    "placeName"   = m.name
FROM legacy_map AS m
WHERE r."sceneJson" IS NULL
  AND r."placeName" IS NULL
  AND r."targetIndex" = m.old_idx
  AND ABS(r."targetLat" - m.lat) < 0.35
  AND ABS(r."targetLon" - m.lon) < 0.35;
