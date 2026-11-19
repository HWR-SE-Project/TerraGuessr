import { randomInt } from 'node:crypto';
import type { LatLon } from '../../domain/distance.js';
import { haversineKm } from '../../domain/distance.js';

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

export class PanoramaError extends Error {
  readonly statusCode = 503;
  constructor(readonly reason: string) {
    super(reason);
  }
}

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
    if (!key) throw new PanoramaError('Street View is not configured.');
    const candidates = ROAD_TARGETS.map((_, i) => i).filter(
      (i) => !used.includes(i),
    );
    for (let attempt = 0; attempt < 6 && candidates.length; attempt++) {
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
      let response: Response;
      try {
        response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
      } catch {
        throw new PanoramaError(
          'Street View provider could not be reached. Please retry.',
        );
      }
      if (!response.ok)
        throw new PanoramaError(
          'Street View provider is unavailable. Please retry.',
        );
      let data: {
        status?: string;
        pano_id?: string;
        location?: { lat: number; lng: number };
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new PanoramaError(
          'Street View provider returned an invalid response.',
        );
      }
      if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND')
        continue;
      if (data.status !== 'OK')
        throw new PanoramaError(
          'Street View access was denied or its quota is exhausted. Check the server API configuration.',
        );
      if (
        data.pano_id &&
        data.location &&
        Number.isFinite(data.location.lat) &&
        Number.isFinite(data.location.lng) &&
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
    if (!key) throw new PanoramaError('Street View is not configured.');
    const url = new URL(
      'https://maps.googleapis.com/maps/api/streetview/metadata',
    );
    url.search = new URLSearchParams({ pano: panoId, key }).toString();
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await response.json()) as {
        status?: string;
        location?: { lat: number; lng: number };
      };
      if (
        response.ok &&
        data.status === 'OK' &&
        data.location &&
        Number.isFinite(data.location.lat) &&
        Number.isFinite(data.location.lng)
      )
        return { lat: data.location.lat, lon: data.location.lng };
    } catch {
      /* Do not log request URLs or provider responses containing keys. */
    }
    throw new PanoramaError(
      'The panorama position could not be verified. Please retry.',
    );
  };
}
