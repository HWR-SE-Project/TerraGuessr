/**
 * Games contract (API-CONTRACTS.md §1), implemented as TypeBox schemas
 * (ADR-0010: the runtime source of truth). Types are derived from the schemas
 * so there is exactly one artifact.
 */

import { Type, type Static } from '@sinclair/typebox';

const GameMode = Type.Union([
  Type.Literal('solo'),
  Type.Literal('challenge'),
]);

const Difficulty = Type.Union([
  Type.Literal('easy'),
  Type.Literal('medium'),
  Type.Literal('hard'),
]);

const Continent = Type.Union([
  Type.Literal('AFRICA'), Type.Literal('EUROPE'), Type.Literal('ASIA'),
  Type.Literal('NORTH_AMERICA'), Type.Literal('SOUTH_AMERICA'), Type.Literal('OCEANIA'),
]);

const GameStatus = Type.Union([
  Type.Literal('active'),
  Type.Literal('completed'),
]);

const RoundStatus = Type.Union([
  Type.Literal('active'),
  Type.Literal('completed'),
]);

/** The in-progress round of a game summary, if any. */
const CurrentRound = Type.Object({
  roundId: Type.String(),
  roundNumber: Type.Integer(),
  status: RoundStatus,
});

/** POST /api/games request body. */
export const CreateGameBody = Type.Object({
  mode: GameMode,
  difficulty: Difficulty,
  roundsTotal: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
  geography: Type.Optional(Type.Union([Type.Literal('world'), Continent])),
  candidateCount: Type.Optional(Type.Integer({ minimum: 2, maximum: 4 })),
}, { additionalProperties: false });

/** POST /api/games → 201. `playerToken` is returned exactly once (ADR-0011). */
export const CreateGameResponse = Type.Object({
  gameId: Type.String(),
  playerToken: Type.String(),
  roundsTotal: Type.Integer({ minimum: 1, maximum: 20 }),
});

/** GET /api/games/:gameId path params. */
export const GameIdParams = Type.Object({
  gameId: Type.String(),
});

/** GET /api/games/:gameId → 200 game summary. */
export const GameSummary = Type.Object({
  gameId: Type.String(),
  mode: GameMode,
  difficulty: Difficulty,
  roundsTotal: Type.Integer({ minimum: 1, maximum: 20 }),
  status: GameStatus,
  roundsPlayed: Type.Integer(),
  currentRound: Type.Union([CurrentRound, Type.Null()]),
});

export type CreateGameBody = Static<typeof CreateGameBody>;
export type CreateGameResponse = Static<typeof CreateGameResponse>;
export type GameIdParams = Static<typeof GameIdParams>;
export type GameSummary = Static<typeof GameSummary>;
