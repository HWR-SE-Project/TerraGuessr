import { randomInt } from 'node:crypto';
import type { LatLon } from '../../domain/distance.js';
import { haversineKm } from '../../domain/distance.js';
import { PanoramaError, providerFailure } from './providerErrors.js';
export { PanoramaError } from './providerErrors.js';

// Independently selected road coordinates, not a catalogue of Google imagery.
// Coverage is checked live. A failed lookup is never treated as a panorama.
export const ROAD_TARGETS = [
  [51.5009, -0.1246],
  [48.853, 2.3499],
  [41.8902, 12.4923],
  [40.4168, -3.7038],
  [52.3702, 4.8952],
  [59.9139, 10.7522],
  [55.6761, 12.5683],
  [47.3769, 8.5417],
  [38.7223, -9.1393],
  [50.0875, 14.4213],
  [35.6595, 139.7005],
  [37.5665, 126.978],
  [1.2868, 103.8545],
  [13.7563, 100.5018],
  [25.033, 121.5654],
  [-33.8688, 151.2093],
  [-37.8136, 144.9631],
  [-36.8485, 174.7633],
  [40.758, -73.9855],
  [37.7955, -122.3937],
  [43.6532, -79.3832],
  [49.2827, -123.1207],
  [19.4326, -99.1332],
  [4.5981, -74.0758],
  [-34.6037, -58.3816],
  [-33.4489, -70.6693],
  [-23.5505, -46.6333],
  [-33.9249, 18.4241],
  [-1.2864, 36.8172],
  [6.5244, 3.3792],
] as const;

export interface PanoramaTarget {
  panoId: string;
  targetIndex: number;
  lat: number;
  lon: number;
}
export type PanoramaProvider = (used: number[]) => Promise<PanoramaTarget>;

export function googlePanoramaProvider(
  key: string | undefined,
  fetcher: typeof fetch = fetch,
): PanoramaProvider {
  return async (used) => {
    if (!key)
      throw new PanoramaError(
        'GOOGLE_MAPS_SERVER_API_KEY is missing. Configure the server Street View key and restart the backend.',
        'MISSING_SERVER_KEY',
      );
    const candidates = ROAD_TARGETS.map((_, i) => i).filter(
      (i) => !used.includes(i),
    );
    for (let attempt = 0; attempt < 12 && candidates.length; attempt++) {
      const index = candidates.splice(randomInt(candidates.length), 1)[0]!;
      const [lat, lon] = ROAD_TARGETS[index]!;
      const url = new URL(
        'https://maps.googleapis.com/maps/api/streetview/metadata',
      );
      url.search = new URLSearchParams({
        location: `${lat},${lon}`,
        radius: '50',
        source: 'outdoor',
        key,
      }).toString();
      const data = await metadata(url, fetcher);
      if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND')
        continue;
      if (data.status !== 'OK')
        throw providerFailure(data.status, data.error_message);
      // The metadata endpoint can return contributor photospheres despite an
      // outdoor query. Those often have no street links and cannot be played.
      if (!/(?:^|[\s©])Google(?: LLC)?$/.test(data.copyright ?? '')) continue;
      if (
        data.pano_id &&
        data.location &&
        validPosition(data.location) &&
        haversineKm(
          { lat, lon },
          { lat: data.location.lat, lon: data.location.lng },
        ) <= 0.05
      ) {
        // Store our target, not Google's returned coordinates or other metadata.
        return { panoId: data.pano_id, targetIndex: index, lat, lon };
      }
    }
    throw new PanoramaError(
      'No outdoor panorama is available nearby. Please retry.',
    );
  };
}

/** Resolve the exact panorama position live; never persist provider coordinates. */
export function googlePanoramaLocator(
  key: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  return async (panoId: string): Promise<LatLon> => {
    if (!key)
      throw new PanoramaError(
        'GOOGLE_MAPS_SERVER_API_KEY is missing. Configure the server Street View key and restart the backend.',
        'MISSING_SERVER_KEY',
      );
    const url = new URL(
      'https://maps.googleapis.com/maps/api/streetview/metadata',
    );
    url.search = new URLSearchParams({ pano: panoId, key }).toString();
    const data = await metadata(url, fetcher);
    if (data.status !== 'OK')
      throw providerFailure(data.status, data.error_message);
    if (!data.location || !validPosition(data.location))
      throw new PanoramaError(
        'The panorama position could not be verified. Please retry.',
        'PROVIDER_INVALID_RESPONSE',
      );
    return { lat: data.location.lat, lon: data.location.lng };
  };
}

interface Metadata {
  copyright?: string;
  status?: string;
  error_message?: string;
  pano_id?: string;
  location?: { lat: number; lng: number };
}
function validPosition(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}
async function metadata(url: URL, fetcher: typeof fetch): Promise<Metadata> {
  let response: Response;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new PanoramaError(
      'Street View provider could not be reached. Check the server network connection and retry.',
      'PROVIDER_NETWORK_ERROR',
    );
  }
  if (response.status === 429) throw providerFailure('OVER_QUERY_LIMIT');
  if (response.status >= 500)
    throw new PanoramaError(
      'Google Street View is temporarily unavailable. Please retry.',
      'PROVIDER_NETWORK_ERROR',
    );
  let data: Metadata;
  try {
    data = (await response.json()) as Metadata;
  } catch {
    throw new PanoramaError(
      'Street View provider returned an invalid response. Please retry.',
      'PROVIDER_INVALID_RESPONSE',
    );
  }
  if (!data || typeof data !== 'object' || typeof data.status !== 'string')
    throw new PanoramaError(
      'Street View provider returned an invalid response. Please retry.',
      'PROVIDER_INVALID_RESPONSE',
    );
  if (!response.ok) throw providerFailure(data.status, data.error_message);
  return data;
}
