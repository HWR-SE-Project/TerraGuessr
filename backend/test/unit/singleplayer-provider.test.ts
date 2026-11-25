import { describe, expect, it } from 'vitest';
import {
  catalogLocationLocator,
  catalogLocationProvider,
  PanoramaError,
  ROAD_TARGETS,
} from '../../src/modules/singleplayer/provider.js';
import {
  LOCATION_CATALOG,
  placeNameForTarget,
  resolveRoundLocation,
} from '../../src/modules/singleplayer/locations.js';

describe('catalog location provider', () => {
  it('selects an unused land target from the catalog with biome metadata', async () => {
    const provider = catalogLocationProvider();
    const excluded = [0, 1, 2];
    const result = await provider(excluded);
    expect(excluded).not.toContain(result.targetIndex);
    expect([result.lat, result.lon]).toEqual(ROAD_TARGETS[result.targetIndex]);
    expect(result.biome).toBe(LOCATION_CATALOG[result.targetIndex]!.biome);
    expect(result.panoId).toBe(`loc:${result.targetIndex}`);
  });

  it('throws PanoramaError when every catalog target is excluded', async () => {
    const provider = catalogLocationProvider();
    const all = LOCATION_CATALOG.map((_, index) => index);
    await expect(provider(all)).rejects.toBeInstanceOf(PanoramaError);
  });

  it('resolves catalog locations purely server-side without network calls', async () => {
    const locate = catalogLocationLocator();
    const expected = LOCATION_CATALOG[5]!;
    await expect(locate('loc:5')).resolves.toEqual({
      lat: expected.lat,
      lon: expected.lon,
    });
    await expect(locate('unknown')).rejects.toBeInstanceOf(PanoramaError);
  });
});

describe('location identity across catalog migrations', () => {
  it('resolves legacy pre-diorama index/coordinate pairs to their true city names (never mismatched)', () => {
    // In the legacy catalog: index 2 = Rome, index 4 = Amsterdam, index 10 = Tokyo.
    // In the expanded catalog: index 2 = Berlin, index 4 = Rome, index 10 = Shanghai.
    expect(
      resolveRoundLocation({
        placeName: null,
        targetIndex: 2,
        targetLat: 41.8902,
        targetLon: 12.4923,
      }),
    ).toEqual({ name: 'Rome', biome: 'urban' });

    expect(
      resolveRoundLocation({
        placeName: null,
        targetIndex: 4,
        targetLat: 52.3702,
        targetLon: 4.8952,
      }),
    ).toEqual({ name: 'Amsterdam', biome: 'coast' });

    expect(
      resolveRoundLocation({
        placeName: null,
        targetIndex: 10,
        targetLat: 35.6595,
        targetLon: 139.7005,
      }),
    ).toEqual({ name: 'Tokyo', biome: 'urban' });
  });

  it('prefers persisted placeName and returns null for synthetic coordinates far from any catalog city', () => {
    expect(
      resolveRoundLocation({
        placeName: 'Custom City',
        targetIndex: 2,
        targetLat: 41.8902,
        targetLon: 12.4923,
      }).name,
    ).toBe('Custom City');

    expect(
      resolveRoundLocation({
        placeName: null,
        targetIndex: 2,
        targetLat: 0,
        targetLon: 0,
      }).name,
    ).toBeNull();

    expect(
      placeNameForTarget({ targetIndex: 2, lat: 52.52, lon: 13.405 }),
    ).toBe('Berlin');
    expect(
      placeNameForTarget({ targetIndex: 2, lat: 0, lon: 0 }),
    ).toBeNull();
  });
});
