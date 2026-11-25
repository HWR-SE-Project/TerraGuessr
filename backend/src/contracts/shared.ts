/**
 * Shared TypeBox schema atoms (ADR-0010). Coordinates, difficulty, candidate
 * and additional-data-access shapes were previously hand-rolled in three
 * modules (singleplayer/routes.ts, results/routes.ts, contracts/lobbies.ts).
 * These atoms are the single source of truth; modules compose them into their
 * own request/response schemas.
 */

import { Type } from '@sinclair/typebox';
import { MAX_ROUNDS_TOTAL, MIN_ROUNDS_TOTAL } from '../config/constants.js';

export const RoundsTotal = Type.Integer({
  minimum: MIN_ROUNDS_TOTAL,
  maximum: MAX_ROUNDS_TOTAL,
});

export const Coordinates = Type.Object(
  {
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);

export const Difficulty = Type.Union([
  Type.Literal('easy'),
  Type.Literal('medium'),
  Type.Literal('hard'),
]);

export const Candidate = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    region: Type.String(),
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);

export const CandidateChoice = Type.Object(
  {
    candidateId: Type.String({ minLength: 1, maxLength: 100 }),
  },
  { additionalProperties: false },
);

export const SelectionInput = Type.Union([Coordinates, CandidateChoice]);

export const EvaluatedAttempt = Type.Object(
  {
    attemptNumber: Type.Integer(),
    guess: Coordinates,
    distanceKm: Type.Number(),
    score: Type.Integer(),
    isBest: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ExtraDataAccess = Type.Object({
  mode: Type.Union([
    Type.Literal('immediate'),
    Type.Literal('points'),
    Type.Literal('time'),
  ]),
  cost: Type.Union([Type.Integer(), Type.Null()]),
  availableAt: Type.Union([Type.String(), Type.Null()]),
  unlocked: Type.Boolean(),
  pointsSpent: Type.Integer(),
});

const SelectionMode = Type.Union([
  Type.Literal('map'),
  Type.Literal('list'),
]);

/** R5 shared extra-data policy for the selected difficulty. */
const ExtraDataPolicyView = Type.Union([
  Type.Object({ mode: Type.Literal('free') }, { additionalProperties: false }),
  Type.Object(
    { mode: Type.Literal('points'), cost: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    { mode: Type.Literal('time'), cost: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false },
  ),
]);

/** Public difficulty rules shared by all game modes. */
export const GameRulesView = Type.Object({
  timeLimitSeconds: Type.Integer({ minimum: 1 }),
  attemptsPerRound: Type.Integer({ minimum: 1 }),
  selectionMode: SelectionMode,
  countryBorders: Type.Boolean(),
  extraData: ExtraDataPolicyView,
});

export const BiomeSchema = Type.Union([
  Type.Literal('desert'),
  Type.Literal('forest'),
  Type.Literal('mountains'),
  Type.Literal('tundra'),
  Type.Literal('coast'),
  Type.Literal('grasslands'),
  Type.Literal('urban'),
]);

export const SceneWeatherSchema = Type.Union([
  Type.Literal('clear'),
  Type.Literal('cloudy'),
  Type.Literal('fog'),
  Type.Literal('rain'),
  Type.Literal('storm'),
  Type.Literal('snow'),
]);

export const SceneLightingSchema = Type.Union([
  Type.Literal('day'),
  Type.Literal('dusk'),
  Type.Literal('night'),
]);

export const TemperatureBandSchema = Type.Union([
  Type.Literal('freezing'),
  Type.Literal('cold'),
  Type.Literal('mild'),
  Type.Literal('warm'),
  Type.Literal('hot'),
]);

export const WindBandSchema = Type.Union([
  Type.Literal('calm'),
  Type.Literal('breezy'),
  Type.Literal('windy'),
]);

/** R04-safe 3D biome diorama parameters sent to the client during an active round. */
export const RoundSceneView = Type.Object(
  {
    biome: BiomeSchema,
    weather: SceneWeatherSchema,
    lighting: SceneLightingSchema,
    temperatureBand: TemperatureBandSchema,
    windBand: WindBandSchema,
    seed: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
