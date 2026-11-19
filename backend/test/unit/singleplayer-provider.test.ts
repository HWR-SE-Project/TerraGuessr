import { describe, expect, it, vi } from 'vitest';
import {
  googlePanoramaProvider,
  googlePanoramaLocator,
  PanoramaError,
  ROAD_TARGETS,
} from '../../src/modules/singleplayer/provider.js';

function transport(handler: (url: URL) => unknown) {
  return vi.fn(
    async (input: string | URL | Request) =>
      new Response(JSON.stringify(handler(new URL(String(input))))),
  ) as unknown as typeof fetch;
}
describe('live Street View provider adapter (transport doubles)', () => {
  it('does not request a panorama without credentials', async () => {
    const fetcher = vi.fn();
    await expect(
      googlePanoramaProvider(undefined, fetcher)([]),
    ).rejects.toBeInstanceOf(PanoramaError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates coverage and keeps only a pano ID and independently authored target', async () => {
    const fetcher = transport((url) => {
      expect(url.hostname).toBe('maps.googleapis.com');
      expect(url.searchParams.get('source')).toBe('outdoor');
      const [lat, lng] = url.searchParams
        .get('location')!
        .split(',')
        .map(Number);
      return {
        status: 'OK',
        copyright: '© Google',
        pano_id: 'test-only-panorama',
        location: { lat: lat! + 0.00001, lng },
      };
    });
    const result = await googlePanoramaProvider(
      'test-only-key',
      fetcher,
    )([0, 1, 2]);
    expect([0, 1, 2]).not.toContain(result.targetIndex);
    expect([result.lat, result.lon]).toEqual(ROAD_TARGETS[result.targetIndex]);
    expect(Object.keys(result).sort()).toEqual([
      'lat',
      'lon',
      'panoId',
      'targetIndex',
    ]);
  });
  it('bounds unavailable coverage retries', async () => {
    const fetcher = transport(() => ({ status: 'ZERO_RESULTS' }));
    await expect(
      googlePanoramaProvider('test-only-key', fetcher)([]),
    ).rejects.toThrow('No outdoor panorama');
    expect(fetcher).toHaveBeenCalledTimes(12);
  });
  it('fails immediately for denied access without leaking a key', async () => {
    const fetcher = transport(() => ({
      status: 'REQUEST_DENIED',
      error_message: 'test-only-key',
    }));
    await expect(
      googlePanoramaProvider('test-only-key', fetcher)([]),
    ).rejects.toThrow('Google denied');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects network errors and malformed provider payloads', async () => {
    await expect(
      googlePanoramaProvider(
        'test-only-key',
        vi.fn().mockRejectedValue(new Error('secret URL')),
      )([]),
    ).rejects.toThrow('could not be reached');
    await expect(
      googlePanoramaProvider(
        'test-only-key',
        vi.fn().mockResolvedValue(new Response('invalid-json')),
      )([]),
    ).rejects.toThrow('invalid response');
  });
  it('never accepts distant or invalid panorama coordinates', async () => {
    const fetcher = transport(() => ({
      status: 'OK',
      copyright: '© Google',
      pano_id: 'test-only',
      location: { lat: 0, lng: 0 },
    }));
    await expect(
      googlePanoramaProvider('test-only-key', fetcher)([]),
    ).rejects.toThrow('No outdoor panorama');
  });
  it('resolves the exact panorama position for scoring live', async () => {
    const fetcher = transport((url) => {
      expect(url.searchParams.get('pano')).toBe('test-only-panorama');
      return {
        status: 'OK',
        copyright: '© Google',
        location: { lat: 51.50091, lng: -0.12461 },
      };
    });
    await expect(
      googlePanoramaLocator('test-only-key', fetcher)('test-only-panorama'),
    ).resolves.toEqual({ lat: 51.50091, lon: -0.12461 });
  });
  it('does not manufacture a location when an expired pano cannot be resolved', async () => {
    await expect(
      googlePanoramaLocator(
        'test-only-key',
        transport(() => ({ status: 'NOT_FOUND' })),
      )('expired'),
    ).rejects.toThrow('no longer available');
  });
});

it('rejects isolated contributor photospheres before accepting a Google street panorama', async () => {
  let calls = 0;
  const fetcher = transport((url) => {
    const [lat, lng] = url.searchParams.get('location')!.split(',').map(Number);
    return {
      status: 'OK',
      copyright: ++calls === 1 ? '© Contributor' : '© 2026 Google',
      pano_id: `test-pano-${calls}`,
      location: { lat, lng },
    };
  });
  const selected = await googlePanoramaProvider('test-only-key', fetcher)([]);
  expect(selected.panoId).toBe('test-pano-2');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([
  ['OVER_QUERY_LIMIT', '', 'PROVIDER_QUOTA_EXCEEDED'],
  ['REQUEST_DENIED', 'Billing is not enabled', 'PROVIDER_BILLING_DISABLED'],
  [
    'REQUEST_DENIED',
    'The API key is invalid test-only-key',
    'PROVIDER_KEY_INVALID',
  ],
  [
    'REQUEST_DENIED',
    'This project is not authorized to use this API',
    'PROVIDER_API_DISABLED',
  ],
])(
  'identifies %s %s without leaking provider text or keys',
  async (status, error_message, code) => {
    const fetcher = transport(() => ({ status, error_message }));
    const error = await googlePanoramaProvider(
      'test-only-key',
      fetcher,
    )([]).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code, statusCode: 503 });
    expect((error as Error).message).not.toContain('test-only-key');
  },
);
