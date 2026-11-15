/**
 * Rounds contract (API-CONTRACTS.md §2), implemented as TypeBox schemas
 * (ADR-0010: the runtime source of truth). Types are derived from the schemas
 * so there is exactly one artifact.
 */

import { Type, type Static } from '@sinclair/typebox';

const SelectionMode = Type.Union([
  Type.Literal('map'),
  Type.Literal('list'),
]);

const Difficulty = Type.Union([
  Type.Literal('easy'),
  Type.Literal('medium'),
  Type.Literal('hard'),
]);

/** Weather DTO (R03/R06) — exactly these four fields, always present. */
export const WeatherView = Type.Object({
  temperatureC: Type.Number(),
  precipitationMm: Type.Number(),
  humidityPct: Type.Number(),
  windSpeedKmh: Type.Number(),
  airPressureHpa: Type.Union([Type.Number(), Type.Null()]),
  windDirectionDeg: Type.Union([Type.Number(), Type.Null()]),
  uvIndex: Type.Union([Type.Number(), Type.Null()]),
  sunshineDurationSeconds: Type.Union([Type.Number(), Type.Null()]),
  localTime: Type.Union([Type.String(), Type.Null()]),
});

/**
 * A list-mode candidate (R07). Candidate coordinates are the player's options;
 * they never reveal which one is the actual location (R04).
 */
export const CandidateView = Type.Object({
  id: Type.String(),
  name: Type.Union([Type.String(), Type.Null()]),
  lat: Type.Number(),
  lon: Type.Number(),
  region: Type.String(),
});

/** POST /api/games/:gameId/rounds request body. */
export const StartRoundBody = Type.Object({
  selectionMode: Type.Optional(SelectionMode),
});

/** Round response (POST 201 / GET 200). MUST NOT contain the actual location (R04). */
export const RoundView = Type.Object({
  roundId: Type.String(),
  roundNumber: Type.Integer(),
  attemptsTotal: Type.Integer({ minimum: 1, maximum: 5 }),
  difficulty: Difficulty,
  selectionMode: SelectionMode,
  weather: WeatherView,
  candidates: Type.Optional(Type.Array(CandidateView)),
});

/** GET /api/rounds/:roundId path params. */
export const RoundIdParams = Type.Object({
  roundId: Type.String(),
});

export type SelectionMode = Static<typeof SelectionMode>;
export type Difficulty = Static<typeof Difficulty>;
export type StartRoundBody = Static<typeof StartRoundBody>;
export type RoundView = Static<typeof RoundView>;
export type RoundIdParams = Static<typeof RoundIdParams>;
