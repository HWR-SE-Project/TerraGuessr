/**
 * Shared TypeBox schema atoms (ADR-0010). Coordinates, difficulty, candidate
 * and additional-data-access shapes were previously hand-rolled in three
 * modules (singleplayer/routes.ts, results/routes.ts, contracts/lobbies.ts).
 * These atoms are the single source of truth; modules compose them into their
 * own request/response schemas.
 */

import { Type } from '@sinclair/typebox';

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

export const Candidate = Type.Object({
  id: Type.String(),
  name: Type.String(),
  region: Type.String(),
  lat: Type.Number(),
  lon: Type.Number(),
});

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
