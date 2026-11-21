import type { GeographicIntelligence } from '../intelligence/contract.js';
import { isValidStreetWeather } from '../intelligence/validate.js';
import { PanoramaError } from './providerErrors.js';
import { ROAD_TARGETS } from './provider.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import { haversineKm } from '../../domain/distance.js';
import {
  MAX_WEATHER_LOCATION_ATTEMPTS,
  MIN_TARGET_SEPARATION_FROM_RECENT_KM,
} from '../../config/constants.js';

export type IntelligenceLookup = (
  lat: number,
  lon: number,
) => Promise<GeographicIntelligence>;

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
  const [recentLat, recentLon] = ROAD_TARGETS[mostRecent]!;
  const close = ROAD_TARGETS.map((_, i) => i).filter(
    (i) =>
      !alreadyExcluded.includes(i) &&
      i !== mostRecent &&
      haversineKm(
        { lat: recentLat, lon: recentLon },
        { lat: ROAD_TARGETS[i]![0], lon: ROAD_TARGETS[i]![1] },
      ) < MIN_TARGET_SEPARATION_FROM_RECENT_KM,
  );
  if (close.length >= ROAD_TARGETS.length - alreadyExcluded.length) return [];
  return close;
}

/**
 * An endless session eventually plays through the entire finite
 * `ROAD_TARGETS` pool. R08: while an unused location remains, it must never
 * repeat one already played this session (full history stays excluded). Once
 * every location has been used at least once, repeats become unavoidable —
 * at that point only the single most-recently played target is excluded, so
 * the next round merely avoids an *immediate* repeat instead of refusing to
 * start (which would otherwise fail forever past round `ROAD_TARGETS.length`).
 */
export function nextExclusions(usedIndices: readonly number[]): number[] {
  const playedAtLeastOnce = new Set(usedIndices).size;
  const mostRecent = usedIndices.at(-1);
  const history =
    playedAtLeastOnce < ROAD_TARGETS.length
      ? [...usedIndices]
      : mostRecent === undefined
        ? []
        : [mostRecent];
  return [...new Set([...history, ...proximityExclusions(mostRecent, history)])];
}

/** Bounds the outer weather-validation loop; the provider's own candidate
 * exhaustion (ROAD_TARGETS.length) bounds it further. Never infinite. */
const MAX_WEATHER_ATTEMPTS = MAX_WEATHER_LOCATION_ATTEMPTS;

/**
 * Selects a panorama target whose coordinates also have the mandatory
 * weather data available (R03), automatically excluding and retrying with a
 * different target when it does not (R13). A target rejected for missing
 * weather is added to the exclusion set so it is never re-offered within the
 * same selection, by this call or the underlying provider.
 */
export async function selectValidatedTarget(
  used: number[],
  provider: PanoramaProvider,
  intelligence: IntelligenceLookup,
  maxAttempts = MAX_WEATHER_ATTEMPTS,
): Promise<PanoramaTarget> {
  const excluded = [...used];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Pass a snapshot: `excluded` is mutated below, and callers must never
    // observe it changing out from under a call they already received.
    const target = await provider([...excluded]);
    const data = await intelligence(target.lat, target.lon).catch(() => null);
    if (data && isValidStreetWeather(data.weather)) return target;
    excluded.push(target.targetIndex);
  }
  throw new PanoramaError(
    'No location with available weather data could be found nearby. Please retry.',
    'WEATHER_UNAVAILABLE',
  );
}
