/**
 * Global catalog of verified land locations (R01) with biome classifications
 * for the 3D low-poly biome diorama. Balanced evenly across all 7 biomes
 * (20 locations per biome = 140 land locations across all inhabited continents)
 * so Easy mode can draw same-biome distractors without leaking the answer (R04).
 */

import { haversineKm } from '../../domain/distance.js';
import type { Biome } from '../../domain/scene.js';

export type Region =
  | 'EUROPE'
  | 'ASIA'
  | 'OCEANIA'
  | 'NORTH_AMERICA'
  | 'SOUTH_AMERICA'
  | 'AFRICA';

export interface LocationEntry {
  readonly name: string;
  readonly region: Region;
  readonly lat: number;
  readonly lon: number;
  readonly biome: Biome;
}

export const LOCATION_CATALOG: readonly LocationEntry[] = [
  // --- URBAN (20) -----------------------------------------------------------
  { name: 'London', region: 'EUROPE', lat: 51.5074, lon: -0.1278, biome: 'urban' },
  { name: 'Paris', region: 'EUROPE', lat: 48.8566, lon: 2.3522, biome: 'urban' },
  { name: 'Berlin', region: 'EUROPE', lat: 52.52, lon: 13.405, biome: 'urban' },
  { name: 'Madrid', region: 'EUROPE', lat: 40.4168, lon: -3.7038, biome: 'urban' },
  { name: 'Rome', region: 'EUROPE', lat: 41.9028, lon: 12.4964, biome: 'urban' },
  { name: 'Prague', region: 'EUROPE', lat: 50.0755, lon: 14.4378, biome: 'urban' },
  { name: 'Vienna', region: 'EUROPE', lat: 48.2082, lon: 16.3738, biome: 'urban' },
  { name: 'Tokyo', region: 'ASIA', lat: 35.6762, lon: 139.6503, biome: 'urban' },
  { name: 'Seoul', region: 'ASIA', lat: 37.5665, lon: 126.978, biome: 'urban' },
  { name: 'Bangkok', region: 'ASIA', lat: 13.7563, lon: 100.5018, biome: 'urban' },
  { name: 'Shanghai', region: 'ASIA', lat: 31.2304, lon: 121.4737, biome: 'urban' },
  { name: 'Mumbai', region: 'ASIA', lat: 19.076, lon: 72.8777, biome: 'urban' },
  { name: 'New York', region: 'NORTH_AMERICA', lat: 40.7128, lon: -74.006, biome: 'urban' },
  { name: 'Chicago', region: 'NORTH_AMERICA', lat: 41.8781, lon: -87.6298, biome: 'urban' },
  { name: 'Toronto', region: 'NORTH_AMERICA', lat: 43.6532, lon: -79.3832, biome: 'urban' },
  { name: 'Mexico City', region: 'NORTH_AMERICA', lat: 19.4326, lon: -99.1332, biome: 'urban' },
  { name: 'São Paulo', region: 'SOUTH_AMERICA', lat: -23.5505, lon: -46.6333, biome: 'urban' },
  { name: 'Buenos Aires', region: 'SOUTH_AMERICA', lat: -34.6037, lon: -58.3816, biome: 'urban' },
  { name: 'Melbourne', region: 'OCEANIA', lat: -37.8136, lon: 144.9631, biome: 'urban' },
  { name: 'Lagos', region: 'AFRICA', lat: 6.5244, lon: 3.3792, biome: 'urban' },

  // --- DESERT (20) ----------------------------------------------------------
  { name: 'Cairo', region: 'AFRICA', lat: 30.0444, lon: 31.2357, biome: 'desert' },
  { name: 'Marrakech', region: 'AFRICA', lat: 31.6295, lon: -7.9811, biome: 'desert' },
  { name: 'Tamanrasset', region: 'AFRICA', lat: 22.785, lon: 5.5228, biome: 'desert' },
  { name: 'Windhoek', region: 'AFRICA', lat: -22.5609, lon: 17.0658, biome: 'desert' },
  { name: 'Khartoum', region: 'AFRICA', lat: 15.5007, lon: 32.5599, biome: 'desert' },
  { name: 'Agadez', region: 'AFRICA', lat: 16.9733, lon: 7.9911, biome: 'desert' },
  { name: 'Riyadh', region: 'ASIA', lat: 24.7136, lon: 46.6753, biome: 'desert' },
  { name: 'Dubai', region: 'ASIA', lat: 25.2048, lon: 55.2708, biome: 'desert' },
  { name: 'Amman', region: 'ASIA', lat: 31.9454, lon: 35.9284, biome: 'desert' },
  { name: 'Jodhpur', region: 'ASIA', lat: 26.2389, lon: 73.0243, biome: 'desert' },
  { name: 'Kashgar', region: 'ASIA', lat: 39.4677, lon: 75.9898, biome: 'desert' },
  { name: 'Ashgabat', region: 'ASIA', lat: 37.9601, lon: 58.3261, biome: 'desert' },
  { name: 'Phoenix', region: 'NORTH_AMERICA', lat: 33.4484, lon: -112.074, biome: 'desert' },
  { name: 'Las Vegas', region: 'NORTH_AMERICA', lat: 36.1699, lon: -115.1398, biome: 'desert' },
  { name: 'Hermosillo', region: 'NORTH_AMERICA', lat: 29.0729, lon: -110.9559, biome: 'desert' },
  { name: 'San Pedro de Atacama', region: 'SOUTH_AMERICA', lat: -22.9087, lon: -68.1997, biome: 'desert' },
  { name: 'Arequipa', region: 'SOUTH_AMERICA', lat: -16.409, lon: -71.5375, biome: 'desert' },
  { name: 'Alice Springs', region: 'OCEANIA', lat: -23.698, lon: 133.8807, biome: 'desert' },
  { name: 'Kalgoorlie', region: 'OCEANIA', lat: -30.749, lon: 121.466, biome: 'desert' },
  { name: 'Almería', region: 'EUROPE', lat: 36.834, lon: -2.4637, biome: 'desert' },

  // --- FOREST (20) ----------------------------------------------------------
  { name: 'Vancouver', region: 'NORTH_AMERICA', lat: 49.2827, lon: -123.1207, biome: 'forest' },
  { name: 'Portland', region: 'NORTH_AMERICA', lat: 45.5152, lon: -122.6784, biome: 'forest' },
  { name: 'Quebec City', region: 'NORTH_AMERICA', lat: 46.8139, lon: -71.208, biome: 'forest' },
  { name: 'Thunder Bay', region: 'NORTH_AMERICA', lat: 48.3809, lon: -89.2477, biome: 'forest' },
  { name: 'Oslo', region: 'EUROPE', lat: 59.9139, lon: 10.7522, biome: 'forest' },
  { name: 'Helsinki', region: 'EUROPE', lat: 60.1699, lon: 24.9384, biome: 'forest' },
  { name: 'Freiburg', region: 'EUROPE', lat: 47.999, lon: 7.8421, biome: 'forest' },
  { name: 'Tampere', region: 'EUROPE', lat: 61.4978, lon: 23.761, biome: 'forest' },
  { name: 'Riga', region: 'EUROPE', lat: 56.9496, lon: 24.1052, biome: 'forest' },
  { name: 'Sapporo', region: 'ASIA', lat: 43.0618, lon: 141.3545, biome: 'forest' },
  { name: 'Irkutsk', region: 'ASIA', lat: 52.2869, lon: 104.305, biome: 'forest' },
  { name: 'Kuching', region: 'ASIA', lat: 1.5533, lon: 110.3592, biome: 'forest' },
  { name: 'Chiang Mai', region: 'ASIA', lat: 18.7883, lon: 98.9853, biome: 'forest' },
  { name: 'Manaus', region: 'SOUTH_AMERICA', lat: -3.119, lon: -60.0217, biome: 'forest' },
  { name: 'Iquitos', region: 'SOUTH_AMERICA', lat: -3.7437, lon: -73.2516, biome: 'forest' },
  { name: 'Valdivia', region: 'SOUTH_AMERICA', lat: -39.8142, lon: -73.2459, biome: 'forest' },
  { name: 'Hobart', region: 'OCEANIA', lat: -42.8821, lon: 147.3272, biome: 'forest' },
  { name: 'Rotorua', region: 'OCEANIA', lat: -38.1368, lon: 176.2497, biome: 'forest' },
  { name: 'Kisangani', region: 'AFRICA', lat: 0.5153, lon: 25.191, biome: 'forest' },
  { name: 'Yaoundé', region: 'AFRICA', lat: 3.848, lon: 11.5021, biome: 'forest' },

  // --- MOUNTAINS (20) -------------------------------------------------------
  { name: 'Zürich', region: 'EUROPE', lat: 47.3769, lon: 8.5417, biome: 'mountains' },
  { name: 'Innsbruck', region: 'EUROPE', lat: 47.2692, lon: 11.4041, biome: 'mountains' },
  { name: 'Chamonix', region: 'EUROPE', lat: 45.9237, lon: 6.8694, biome: 'mountains' },
  { name: 'Tbilisi', region: 'EUROPE', lat: 41.7151, lon: 44.8271, biome: 'mountains' },
  { name: 'Andorra la Vella', region: 'EUROPE', lat: 42.5063, lon: 1.5218, biome: 'mountains' },
  { name: 'Kathmandu', region: 'ASIA', lat: 27.7172, lon: 85.324, biome: 'mountains' },
  { name: 'Almaty', region: 'ASIA', lat: 43.222, lon: 76.8512, biome: 'mountains' },
  { name: 'Lhasa', region: 'ASIA', lat: 29.65, lon: 91.1, biome: 'mountains' },
  { name: 'Nagano', region: 'ASIA', lat: 36.6485, lon: 138.1942, biome: 'mountains' },
  { name: 'Thimphu', region: 'ASIA', lat: 27.4728, lon: 89.639, biome: 'mountains' },
  { name: 'Denver', region: 'NORTH_AMERICA', lat: 39.7392, lon: -104.9903, biome: 'mountains' },
  { name: 'Banff', region: 'NORTH_AMERICA', lat: 51.1784, lon: -115.5708, biome: 'mountains' },
  { name: 'Salt Lake City', region: 'NORTH_AMERICA', lat: 40.7608, lon: -111.891, biome: 'mountains' },
  { name: 'La Paz', region: 'SOUTH_AMERICA', lat: -16.4897, lon: -68.1193, biome: 'mountains' },
  { name: 'Cusco', region: 'SOUTH_AMERICA', lat: -13.5319, lon: -71.9675, biome: 'mountains' },
  { name: 'Quito', region: 'SOUTH_AMERICA', lat: -0.1807, lon: -78.4678, biome: 'mountains' },
  { name: 'Bogotá', region: 'SOUTH_AMERICA', lat: 4.711, lon: -74.0721, biome: 'mountains' },
  { name: 'Santiago', region: 'SOUTH_AMERICA', lat: -33.4489, lon: -70.6693, biome: 'mountains' },
  { name: 'Queenstown', region: 'OCEANIA', lat: -45.0312, lon: 168.6626, biome: 'mountains' },
  { name: 'Addis Ababa', region: 'AFRICA', lat: 9.03, lon: 38.74, biome: 'mountains' },

  // --- TUNDRA (20) ----------------------------------------------------------
  { name: 'Reykjavík', region: 'EUROPE', lat: 64.1466, lon: -21.9426, biome: 'tundra' },
  { name: 'Tromsø', region: 'EUROPE', lat: 69.6492, lon: 18.9553, biome: 'tundra' },
  { name: 'Longyearbyen', region: 'EUROPE', lat: 78.2232, lon: 15.6267, biome: 'tundra' },
  { name: 'Rovaniemi', region: 'EUROPE', lat: 66.5039, lon: 25.7294, biome: 'tundra' },
  { name: 'Kiruna', region: 'EUROPE', lat: 67.8558, lon: 20.2253, biome: 'tundra' },
  { name: 'Murmansk', region: 'EUROPE', lat: 68.9585, lon: 33.0827, biome: 'tundra' },
  { name: 'Akureyri', region: 'EUROPE', lat: 65.6885, lon: -18.1262, biome: 'tundra' },
  { name: 'Tórshavn', region: 'EUROPE', lat: 62.0079, lon: -6.79, biome: 'tundra' },
  { name: 'Nuuk', region: 'NORTH_AMERICA', lat: 64.1814, lon: -51.6941, biome: 'tundra' },
  { name: 'Fairbanks', region: 'NORTH_AMERICA', lat: 64.8378, lon: -147.7164, biome: 'tundra' },
  { name: 'Anchorage', region: 'NORTH_AMERICA', lat: 61.2181, lon: -149.9003, biome: 'tundra' },
  { name: 'Yellowknife', region: 'NORTH_AMERICA', lat: 62.454, lon: -114.3718, biome: 'tundra' },
  { name: 'Whitehorse', region: 'NORTH_AMERICA', lat: 60.7212, lon: -135.0568, biome: 'tundra' },
  { name: 'Iqaluit', region: 'NORTH_AMERICA', lat: 63.7467, lon: -68.517, biome: 'tundra' },
  { name: 'Utqiaġvik', region: 'NORTH_AMERICA', lat: 71.2906, lon: -156.7886, biome: 'tundra' },
  { name: 'Yakutsk', region: 'ASIA', lat: 62.0355, lon: 129.6755, biome: 'tundra' },
  { name: 'Norilsk', region: 'ASIA', lat: 69.3558, lon: 88.1893, biome: 'tundra' },
  { name: 'Magadan', region: 'ASIA', lat: 59.5682, lon: 150.8085, biome: 'tundra' },
  { name: 'Ushuaia', region: 'SOUTH_AMERICA', lat: -54.8019, lon: -68.303, biome: 'tundra' },
  { name: 'Punta Arenas', region: 'SOUTH_AMERICA', lat: -53.1638, lon: -70.9171, biome: 'tundra' },

  // --- COAST (20) -----------------------------------------------------------
  { name: 'Lisbon', region: 'EUROPE', lat: 38.7223, lon: -9.1393, biome: 'coast' },
  { name: 'Barcelona', region: 'EUROPE', lat: 41.3874, lon: 2.1686, biome: 'coast' },
  { name: 'Athens', region: 'EUROPE', lat: 37.9838, lon: 23.7275, biome: 'coast' },
  { name: 'Copenhagen', region: 'EUROPE', lat: 55.6761, lon: 12.5683, biome: 'coast' },
  { name: 'Amsterdam', region: 'EUROPE', lat: 52.3676, lon: 4.9041, biome: 'coast' },
  { name: 'Dubrovnik', region: 'EUROPE', lat: 42.6507, lon: 18.0944, biome: 'coast' },
  { name: 'Sydney', region: 'OCEANIA', lat: -33.8688, lon: 151.2093, biome: 'coast' },
  { name: 'Auckland', region: 'OCEANIA', lat: -36.8485, lon: 174.7633, biome: 'coast' },
  { name: 'Honolulu', region: 'OCEANIA', lat: 21.3069, lon: -157.8583, biome: 'coast' },
  { name: 'Suva', region: 'OCEANIA', lat: -18.1416, lon: 178.4419, biome: 'coast' },
  { name: 'San Francisco', region: 'NORTH_AMERICA', lat: 37.7749, lon: -122.4194, biome: 'coast' },
  { name: 'Miami', region: 'NORTH_AMERICA', lat: 25.7617, lon: -80.1918, biome: 'coast' },
  { name: 'Havana', region: 'NORTH_AMERICA', lat: 23.1136, lon: -82.3666, biome: 'coast' },
  { name: 'Rio de Janeiro', region: 'SOUTH_AMERICA', lat: -22.9068, lon: -43.1729, biome: 'coast' },
  { name: 'Cartagena', region: 'SOUTH_AMERICA', lat: 10.391, lon: -75.4794, biome: 'coast' },
  { name: 'Singapore', region: 'ASIA', lat: 1.3521, lon: 103.8198, biome: 'coast' },
  { name: 'Taipei', region: 'ASIA', lat: 25.033, lon: 121.5654, biome: 'coast' },
  { name: 'Denpasar', region: 'ASIA', lat: -8.6705, lon: 115.2126, biome: 'coast' },
  { name: 'Cape Town', region: 'AFRICA', lat: -33.9249, lon: 18.4241, biome: 'coast' },
  { name: 'Zanzibar City', region: 'AFRICA', lat: -6.1659, lon: 39.2026, biome: 'coast' },

  // --- GRASSLANDS (20) ------------------------------------------------------
  { name: 'Nairobi', region: 'AFRICA', lat: -1.2921, lon: 36.8219, biome: 'grasslands' },
  { name: 'Johannesburg', region: 'AFRICA', lat: -26.2041, lon: 28.0473, biome: 'grasslands' },
  { name: 'Gaborone', region: 'AFRICA', lat: -24.6282, lon: 25.9231, biome: 'grasslands' },
  { name: 'Lusaka', region: 'AFRICA', lat: -15.3875, lon: 28.3228, biome: 'grasslands' },
  { name: 'Harare', region: 'AFRICA', lat: -17.8252, lon: 31.0335, biome: 'grasslands' },
  { name: 'Ulaanbaatar', region: 'ASIA', lat: 47.8864, lon: 106.9057, biome: 'grasslands' },
  { name: 'Astana', region: 'ASIA', lat: 51.1694, lon: 71.4491, biome: 'grasslands' },
  { name: 'Bishkek', region: 'ASIA', lat: 42.8746, lon: 74.5698, biome: 'grasslands' },
  { name: 'Novosibirsk', region: 'ASIA', lat: 55.0084, lon: 82.9357, biome: 'grasslands' },
  { name: 'Budapest', region: 'EUROPE', lat: 47.4979, lon: 19.0402, biome: 'grasslands' },
  { name: 'Kyiv', region: 'EUROPE', lat: 50.4501, lon: 30.5234, biome: 'grasslands' },
  { name: 'Bucharest', region: 'EUROPE', lat: 44.4268, lon: 26.1025, biome: 'grasslands' },
  { name: 'Dublin', region: 'EUROPE', lat: 53.3498, lon: -6.2603, biome: 'grasslands' },
  { name: 'Calgary', region: 'NORTH_AMERICA', lat: 51.0447, lon: -114.0719, biome: 'grasslands' },
  { name: 'Winnipeg', region: 'NORTH_AMERICA', lat: 49.8951, lon: -97.1384, biome: 'grasslands' },
  { name: 'Kansas City', region: 'NORTH_AMERICA', lat: 39.0997, lon: -94.5786, biome: 'grasslands' },
  { name: 'Córdoba', region: 'SOUTH_AMERICA', lat: -31.4201, lon: -64.1888, biome: 'grasslands' },
  { name: 'Montevideo', region: 'SOUTH_AMERICA', lat: -34.9011, lon: -56.1645, biome: 'grasslands' },
  { name: 'Canberra', region: 'OCEANIA', lat: -35.2809, lon: 149.13, biome: 'grasslands' },
  { name: 'Christchurch', region: 'OCEANIA', lat: -43.5321, lon: 172.6362, biome: 'grasslands' },
] as const;

export function locationAt(index: number): LocationEntry | undefined {
  return LOCATION_CATALOG[index];
}

/**
 * Maximum distance (km) to verify a round's coordinates against a catalog entry.
 * Max offset between legacy Street View coordinates and current catalog centers is
 * ~12.6 km, while the closest pair of distinct catalog cities is ~86.8 km apart.
 */
const CATALOG_COORDINATE_MATCH_KM = 40;

/** Find the catalog entry closest to `(lat, lon)` within `CATALOG_COORDINATE_MATCH_KM`. */
export function findCatalogLocationByCoords(
  lat: number,
  lon: number,
): LocationEntry | undefined {
  let best: LocationEntry | undefined;
  let bestDist = CATALOG_COORDINATE_MATCH_KM;
  for (const entry of LOCATION_CATALOG) {
    const dist = haversineKm({ lat, lon }, entry);
    if (dist <= bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

/**
 * Derive a persisted `placeName` for a newly created round target. Returns
 * `null` when a synthetic test target does not match any catalog location
 * near its coordinates.
 */
export function placeNameForTarget(target: {
  placeName?: string;
  targetIndex: number;
  lat: number;
  lon: number;
}): string | null {
  if (target.placeName) return target.placeName;
  const byIndex = locationAt(target.targetIndex);
  if (byIndex && haversineKm({ lat: target.lat, lon: target.lon }, byIndex) <= CATALOG_COORDINATE_MATCH_KM) {
    return byIndex.name;
  }
  return findCatalogLocationByCoords(target.lat, target.lon)?.name ?? null;
}

/**
 * Resolve a round's authoritative display name and biome (R11).
 * Prefers persisted `placeName`; falls back to coordinate-verified catalog
 * lookup so legacy pre-diorama rows (whose `targetIndex` belonged to the old
 * 30-city table) never display a mismatched city name.
 */
export function resolveRoundLocation(round: {
  placeName?: string | null;
  targetIndex: number;
  targetLat: number;
  targetLon: number;
}): { name: string | null; biome: Biome } {
  const point = { lat: round.targetLat, lon: round.targetLon };
  const byIndex = locationAt(round.targetIndex);
  if (byIndex && haversineKm(point, byIndex) <= CATALOG_COORDINATE_MATCH_KM) {
    return {
      name: round.placeName ?? byIndex.name,
      biome: byIndex.biome,
    };
  }
  const byCoords = findCatalogLocationByCoords(round.targetLat, round.targetLon);
  if (byCoords) {
    return {
      name: round.placeName ?? byCoords.name,
      biome: byCoords.biome,
    };
  }
  return {
    name: round.placeName ?? null,
    biome: byIndex?.biome ?? 'grasslands',
  };
}
