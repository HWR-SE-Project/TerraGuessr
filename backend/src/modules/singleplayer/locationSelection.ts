import { randomInt } from 'node:crypto';
import type { GeographicIntelligence } from '../intelligence/contract.js';
import { isValidStreetWeather } from '../intelligence/validate.js';
import { PanoramaError } from './providerErrors.js';
import { LOCATION_CATALOG, locationAt } from './locations.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import { haversineKm } from '../../domain/distance.js';
import type { LatLon } from '../../domain/distance.js';
import { buildRoundScene, type RoundScene } from '../../domain/scene.js';
import {
  MAX_WEATHER_LOCATION_ATTEMPTS,
  MIN_TARGET_SEPARATION_FROM_RECENT_KM,
  WEATHER_MAX_DISPLAY_AGE_MS,
} from '../../config/constants.js';

export type IntelligenceLookup = (
  lat: number,
  lon: number,
) => Promise<GeographicIntelligence>;

export type PanoramaLocator = (panoId: string) => Promise<LatLon>;

/**
 * R01: besides history, exclude any target within
 * `MIN_TARGET_SEPARATION_FROM_RECENT_KM` of the most recently played one, so
 * consecutive rounds don't land in neighbouring locations. Falls back to no
 * exclusion if that would remove the entire pool (never blocks selection).
 */
function proximityExclusions(
  mostRecent: number | undefined,
  alreadyExcluded: readonly number[],
): number[] {
  if (mostRecent === undefined) return [];
  const recent = locationAt(mostRecent);
  if (!recent) return [];
  const close = LOCATION_CATALOG.map((_, i) => i).filter(
    (i) =>
      !alreadyExcluded.includes(i) &&
      i !== mostRecent &&
      haversineKm(
        { lat: recent.lat, lon: recent.lon },
        { lat: LOCATION_CATALOG[i]!.lat, lon: LOCATION_CATALOG[i]!.lon },
      ) < MIN_TARGET_SEPARATION_FROM_RECENT_KM,
  );
  if (close.length >= LOCATION_CATALOG.length - alreadyExcluded.length) return [];
  return close;
}

/**
 * Endless-mode exclusion policy: avoid all previously played targets until the
 * catalog is exhausted, then exclude only the most recent target + nearby ones.
 */
export function nextExclusions(usedIndices: readonly number[]): number[] {
  const playedAtLeastOnce = new Set(usedIndices).size;
  const mostRecent = usedIndices.at(-1);
  const history =
    playedAtLeastOnce < LOCATION_CATALOG.length
      ? [...usedIndices]
      : mostRecent === undefined
        ? []
        : [mostRecent];
  return [...new Set([...history, ...proximityExclusions(mostRecent, history)])];
}

const MAX_WEATHER_ATTEMPTS = MAX_WEATHER_LOCATION_ATTEMPTS;

/** Random per-round diorama seed (never derived from coordinates or index, R04). */
export function generateSceneSeed(): number {
  return randomInt(1, 2_147_483_647);
}

/**
 * Selects a land target whose coordinates have fresh, complete mandatory
 * weather data (R03), discarding and retrying up to `maxAttempts` (default 3)
 * distinct locations total per round (R13) — accounting for any
 * `alreadyAttempted` indices tried in earlier preparation calls — and derives
 * an R04-safe 3D biome diorama `scene` from that weather.
 */
export async function selectRoundWithWeather(
  used: number[],
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  {
    prefetched,
    locate,
    maxAttempts = MAX_WEATHER_ATTEMPTS,
    validAt,
    alreadyAttempted = [],
  }: {
    prefetched?: PanoramaTarget;
    locate?: PanoramaLocator;
    maxAttempts?: number;
    validAt?: Date;
    alreadyAttempted?: readonly number[];
  } = {},
): Promise<{
  target: PanoramaTarget;
  scene: RoundScene;
  weatherValidUntil: Date;
  attemptedIndices: number[];
}> {
  const triedDistinct = new Set<number>(alreadyAttempted);
  const excluded = new Set<number>([...used, ...alreadyAttempted]);

  const checkTarget = async (target: PanoramaTarget) => {
    const point = locate ? await locate(target.panoId) : target;
    const weather = (await intelligence(point.lat, point.lon).catch(() => null))
      ?.weather;
    if (
      weather &&
      isValidStreetWeather(weather, Math.max(Date.now(), validAt?.getTime() ?? 0))
    ) {
      const biome =
        target.biome ?? locationAt(target.targetIndex)?.biome ?? 'grasslands';
      const scene = buildRoundScene({
        biome,
        weather,
        lon: point.lon,
        seed: generateSceneSeed(),
      });
      return {
        target,
        scene,
        weatherValidUntil: new Date(
          Date.parse(weather.modelTime ?? '') + WEATHER_MAX_DISPLAY_AGE_MS,
        ),
        attemptedIndices: [...triedDistinct],
      };
    }
    return null;
  };

  if (prefetched) {
    const alreadyCounted = triedDistinct.has(prefetched.targetIndex);
    if (alreadyCounted || triedDistinct.size < maxAttempts) {
      triedDistinct.add(prefetched.targetIndex);
      excluded.add(prefetched.targetIndex);
      const valid = await checkTarget(prefetched);
      if (valid) return valid;
    }
  }

  while (triedDistinct.size < maxAttempts) {
    const target = await provider([...excluded]);
    triedDistinct.add(target.targetIndex);
    excluded.add(target.targetIndex);
    const valid = await checkTarget(target);
    if (valid) return valid;
  }

  throw new PanoramaError(
    'No location with available weather data could be found nearby. Please retry.',
    'WEATHER_UNAVAILABLE',
    [...triedDistinct],
  );
}

export async function selectValidatedTarget(
  ...args: Parameters<typeof selectRoundWithWeather>
): Promise<PanoramaTarget> {
  return (await selectRoundWithWeather(...args)).target;
}
