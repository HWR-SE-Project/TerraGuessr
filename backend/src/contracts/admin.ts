/**
 * Admin contract (API-CONTRACTS.md §5), implemented as TypeBox schemas
 * (ADR-0010: the runtime source of truth). Types are derived from the schemas
 * so there is exactly one artifact.
 */

import { Type, type Static } from '@sinclair/typebox';

/** POST /api/admin/locations/refresh → 202 (API-CONTRACTS.md §5). */
export const RefreshLocationsResponse = Type.Object({
  jobId: Type.String(),
});

/** POST /api/admin/weather/prefetch → 202 (API-CONTRACTS.md §5). */
export const WeatherPrefetchResponse = Type.Object({
  warmed: Type.Integer(),
});

export type RefreshLocationsResponse = Static<typeof RefreshLocationsResponse>;
export type WeatherPrefetchResponse = Static<typeof WeatherPrefetchResponse>;
