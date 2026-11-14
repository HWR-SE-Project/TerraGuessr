/**
 * Pure helpers for building the pre-baked land location pool (D-02 / ADR-0004).
 *
 * These functions are intentionally free of I/O and database access: the land
 * geometry is passed in as a parsed object and the RNG is injected, so sampling
 * is deterministic and unit-testable.
 *
 * GeoJSON positions use CRS84 axis order, i.e. [longitude, latitude].
 */

export const REGIONS = [
  'AFRICA',
  'EUROPE',
  'ASIA',
  'NORTH_AMERICA',
  'SOUTH_AMERICA',
  'OCEANIA',
] as const;

export type Region = (typeof REGIONS)[number];

/** A GeoJSON position in CRS84 order: [longitude, latitude]. */
export type LngLat = readonly [number, number];

/** A single closed ring of positions (an outer ring or a hole). */
export type PolygonRing = readonly LngLat[];

/** An axis-aligned bounding box in degrees. */
export interface BBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** A land polygon: one outer ring plus optional holes. */
export interface LandPolygon {
  ring: PolygonRing;
  holes: PolygonRing[];
  bbox: BBox;
}

/** Loose structural type for the vendored Natural Earth FeatureCollection. */
export interface LandGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
}

/** A sampled candidate location. */
export interface LandPoint {
  lat: number;
  lon: number;
  region: Region;
}

/** A function returning a uniformly distributed float in [0, 1). */
export type Rng = () => number;

/**
 * Even-odd ray-casting test for a point against a single polygon ring.
 *
 * `polygon` is a list of [lon, lat] positions; `lat` and `lon` are the
 * query point. Returns true when the point lies inside (or on) the ring.
 */
export function pointInPolygon(
  lat: number,
  lon: number,
  polygon: PolygonRing,
): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i]?.[0] ?? 0;
    const yi = polygon[i]?.[1] ?? 0;
    const xj = polygon[j]?.[0] ?? 0;
    const yj = polygon[j]?.[1] ?? 0;

    const crossesLatitude = (yi > lat) !== (yj > lat);
    if (!crossesLatitude) continue;

    const xAtLat = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lon < xAtLat) inside = !inside;
  }

  return inside;
}

interface RegionBounds {
  region: Region;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Ordered bounding-box rules for the six-region split (first match wins). The
 * order resolves the genuinely ambiguous boundary zones: Greenland and Iceland
 * are North America, Central America belongs to North America, New Guinea to
 * Asia, and the Bering-strait tip of Russia is Asia. Any point not matched by a
 * box (Southern Ocean, antimeridian Pacific islands) falls back to OCEANIA.
 */
const REGION_BOUNDS: readonly RegionBounds[] = [
  { region: 'SOUTH_AMERICA', minLat: -56, maxLat: 8, minLon: -82, maxLon: -34 },
  { region: 'NORTH_AMERICA', minLat: 8, maxLat: 84, minLon: -170, maxLon: -13 },
  { region: 'AFRICA', minLat: -35, maxLat: 37, minLon: -20, maxLon: 52 },
  { region: 'EUROPE', minLat: 34, maxLat: 72, minLon: -25, maxLon: 60 },
  { region: 'ASIA', minLat: -12, maxLat: 77, minLon: 25, maxLon: 180 },
  { region: 'ASIA', minLat: 50, maxLat: 80, minLon: -180, maxLon: -170 },
  { region: 'OCEANIA', minLat: -50, maxLat: -12, minLon: 110, maxLon: 180 },
];

/** Assign a six-way region to a coordinate using the bounding-box rules above. */
export function regionForLonLat(lat: number, lon: number): Region {
  for (const bounds of REGION_BOUNDS) {
    if (
      lat >= bounds.minLat &&
      lat <= bounds.maxLat &&
      lon >= bounds.minLon &&
      lon <= bounds.maxLon
    ) {
      return bounds.region;
    }
  }
  return 'OCEANIA';
}

function bboxOfRing(ring: PolygonRing): BBox {
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const position of ring) {
    const lon = position[0] ?? 0;
    const lat = position[1] ?? 0;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

function asLngLat(value: unknown): LngLat | null {
  if (!Array.isArray(value)) return null;
  const lon = value[0];
  const lat = value[1];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const position: LngLat = [lon, lat];
  return position;
}

function asRing(value: unknown): PolygonRing | null {
  if (!Array.isArray(value)) return null;

  const points: LngLat[] = [];
  for (const item of value) {
    const position = asLngLat(item);
    if (position === null) return null;
    points.push(position);
  }

  return points.length >= 3 ? points : null;
}

function polygonFromRings(value: unknown): LandPolygon | null {
  if (!Array.isArray(value)) return null;

  const rings: PolygonRing[] = [];
  for (const item of value) {
    const ring = asRing(item);
    if (ring !== null) rings.push(ring);
  }

  const outer = rings[0];
  if (!outer) return null;

  return { ring: outer, holes: rings.slice(1), bbox: bboxOfRing(outer) };
}

/** Flatten a FeatureCollection into outer-ring polygons with holes and bboxes. */
export function extractLandPolygons(geo: LandGeoJson): LandPolygon[] {
  const polygons: LandPolygon[] = [];

  for (const feature of geo.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      const polygon = polygonFromRings(geometry.coordinates);
      if (polygon !== null) polygons.push(polygon);
    } else if (geometry.type === 'MultiPolygon') {
      if (!Array.isArray(geometry.coordinates)) continue;
      for (const sub of geometry.coordinates) {
        const polygon = polygonFromRings(sub);
        if (polygon !== null) polygons.push(polygon);
      }
    }
  }

  return polygons;
}

function boundsForRegion(region: Region): RegionBounds[] {
  return REGION_BOUNDS.filter((bounds) => bounds.region === region);
}

function bboxIntersects(a: BBox, b: RegionBounds): boolean {
  return (
    a.minLon <= b.maxLon &&
    a.maxLon >= b.minLon &&
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat
  );
}

function allocateQuotas(count: number): Record<Region, number> {
  const quotas = {} as Record<Region, number>;
  const base = Math.floor(count / REGIONS.length);
  let remainder = count % REGIONS.length;

  for (const region of REGIONS) {
    quotas[region] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }

  return quotas;
}

/**
 * Rejection-sample `count` land points, split as evenly as possible across
 * the six regions and excluding Antarctica (`lat < -60`).
 *
 * For each region the generator draws candidate points uniformly inside the
 * bounding boxes of polygons that overlap that region, then keeps a point only
 * when it is (a) north of 60S, (b) inside a land ring and outside its holes,
 * and (c) actually classified as the target region by `regionForLonLat`.
 */
export function* sampleLandPoints(
  landGeoJson: LandGeoJson,
  count: number,
  rng: Rng,
): Generator<LandPoint, void, void> {
  if (count <= 0) return;

  const polygons = extractLandPolygons(landGeoJson);
  if (polygons.length === 0) return;

  const quotas = allocateQuotas(count);

  for (const region of REGIONS) {
    const target = quotas[region];
    if (target <= 0) continue;

    const regionBoxes = boundsForRegion(region);
    const candidates = polygons.filter((polygon) =>
      regionBoxes.some((box) => bboxIntersects(polygon.bbox, box)),
    );
    if (candidates.length === 0) continue;

    let found = 0;
    let attempts = 0;
    const maxAttempts = target * 10_000 + 50_000;

    while (found < target && attempts < maxAttempts) {
      attempts += 1;

      const index = Math.min(
        candidates.length - 1,
        Math.floor(rng() * candidates.length),
      );
      const polygon = candidates[index];
      if (!polygon) continue;

      const lon =
        polygon.bbox.minLon + rng() * (polygon.bbox.maxLon - polygon.bbox.minLon);
      const lat =
        polygon.bbox.minLat + rng() * (polygon.bbox.maxLat - polygon.bbox.minLat);

      if (lat < -60) continue;
      if (regionForLonLat(lat, lon) !== region) continue;
      if (!pointInPolygon(lat, lon, polygon.ring)) continue;
      if (polygon.holes.some((hole) => pointInPolygon(lat, lon, hole))) continue;

      yield { lat, lon, region };
      found += 1;
    }
  }
}
