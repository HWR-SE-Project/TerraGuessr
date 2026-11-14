/**
 * Results + guess contract (API-CONTRACTS.md §2/§3), implemented as TypeBox
 * schemas (ADR-0010: the runtime source of truth). Types are derived from the
 * schemas so there is exactly one artifact.
 */

import { Type, type Static } from '@sinclair/typebox';

/** A WGS84 coordinate in decimal degrees. */
export const LatLon = Type.Object({
  lat: Type.Number(),
  lon: Type.Number(),
});

/**
 * POST /api/rounds/:roundId/guess request body. Coordinates are range-checked
 * so out-of-range input is rejected with 400 VALIDATION_ERROR (API-CONTRACTS).
 */
export const SubmitGuessBody = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lon: Type.Number({ minimum: -180, maximum: 180 }),
});

/**
 * POST /api/rounds/:roundId/guess → 200. The ONLY response that reveals the
 * actual location coordinates (R11).
 */
export const GuessResultResponse = Type.Object({
  resultId: Type.String(),
  roundId: Type.String(),
  distanceKm: Type.Number(),
  score: Type.Integer(),
  actual: LatLon,
});

/**
 * One item of a game's results listing. Deliberately coordinate-free: actual
 * coordinates are revealed only in the guess response (R11), never here.
 */
export const ResultListItem = Type.Object({
  resultId: Type.String(),
  roundNumber: Type.Integer(),
  distanceKm: Type.Number(),
  score: Type.Integer(),
});

/** GET /api/results/:resultId path params. */
export const ResultIdParams = Type.Object({
  resultId: Type.String(),
});

export type LatLon = Static<typeof LatLon>;
export type SubmitGuessBody = Static<typeof SubmitGuessBody>;
export type GuessResultResponse = Static<typeof GuessResultResponse>;
export type ResultListItem = Static<typeof ResultListItem>;
export type ResultIdParams = Static<typeof ResultIdParams>;
