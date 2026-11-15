/**
 * Async challenges contract (API-CONTRACTS.md §4, R16/ADR-0005), implemented
 * as TypeBox schemas (ADR-0010: the runtime source of truth). Types are derived
 * from the schemas so there is exactly one artifact.
 */

import { Type, type Static } from '@sinclair/typebox';

import { RoundView } from './rounds.js';

/** POST /api/challenges request body. */
export const CreateChallengeBody = Type.Object({
  roundId: Type.String(),
});

/** POST /api/challenges → 201. `shareUrl` is a relative path, never a domain. */
export const CreateChallengeResponse = Type.Object({
  challengeId: Type.String(),
  shareUrl: Type.String(),
});

/** Path params for the challenge-scoped routes. */
export const ChallengeIdParams = Type.Object({
  challengeId: Type.String(),
});

/** POST /api/challenges/:challengeId/entries request body (R16, B.6). */
export const CreateEntryBody = Type.Object({
  resultId: Type.String(),
  displayName: Type.Optional(Type.String({ maxLength: 40 })),
});

/** POST /api/challenges/:challengeId/entries → 201. */
export const CreateEntryResponse = Type.Object({
  entryId: Type.String(),
  rank: Type.Integer(),
});

/**
 * POST /api/challenges/:challengeId/join request body (P0-3). No auth: this is
 * the entry point for an independent participant, analogous to POST /api/games.
 */
export const JoinChallengeBody = Type.Object({
  selectionMode: Type.Optional(Type.Union([Type.Literal('map'), Type.Literal('list')])),
});

/**
 * POST /api/challenges/:challengeId/join → 201. Issues a fresh player token
 * (ADR-0011) for this participant and a Round pinned to the challenge's
 * location/weather snapshot, ready to guess via the normal rounds endpoints.
 */
export const JoinChallengeResponse = Type.Object({
  gameId: Type.String(),
  playerToken: Type.String(),
  round: RoundView,
});

/** A single public leaderboard entry (R16, B.6). */
export const LeaderboardEntry = Type.Object({
  rank: Type.Integer(),
  displayName: Type.Union([Type.String(), Type.Null()]),
  score: Type.Integer(),
  distanceKm: Type.Number(),
});

/** GET /api/challenges/:challengeId/leaderboard → 200 (public, no auth). */
export const LeaderboardResponse = Type.Object({
  challengeId: Type.String(),
  entries: Type.Array(LeaderboardEntry),
});

export type CreateChallengeBody = Static<typeof CreateChallengeBody>;
export type CreateChallengeResponse = Static<typeof CreateChallengeResponse>;
export type ChallengeIdParams = Static<typeof ChallengeIdParams>;
export type JoinChallengeBody = Static<typeof JoinChallengeBody>;
export type JoinChallengeResponse = Static<typeof JoinChallengeResponse>;
export type CreateEntryBody = Static<typeof CreateEntryBody>;
export type CreateEntryResponse = Static<typeof CreateEntryResponse>;
export type LeaderboardEntry = Static<typeof LeaderboardEntry>;
export type LeaderboardResponse = Static<typeof LeaderboardResponse>;
