/**
 * Challenges routes (B-10, R16/ADR-0005). Registered by
 * `registerChallengesRoutes` from app.ts.
 *
 * The two POST routes enforce player-token ownership of the referenced
 * round/result (ADR-0011 → 404, never 401). The leaderboard is PUBLIC (B.6):
 * anyone with the share link can view it, no auth required.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import {
  ChallengeIdParams,
  CreateChallengeBody,
  CreateChallengeResponse,
  CreateEntryBody,
  CreateEntryResponse,
  JoinChallengeBody,
  JoinChallengeResponse,
  LeaderboardResponse,
} from '../../contracts/challenges.js';
import { GameNotFoundError, hashPlayerToken } from '../../plugins/auth.js';
import { addEntry, createChallenge, getLeaderboard, joinChallenge } from './service.js';

/**
 * Auth hook for POST /api/challenges: the round referenced in the BODY must
 * belong to the player token. Runs as a `preHandler` (body is parsed/validated
 * by then); a missing/unknown token or round is reported as 404 (ADR-0011).
 */
function requireRoundOwnerByBody(
  db: PrismaClient,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request) => {
    const rawToken = request.headers['x-player-token'];
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new GameNotFoundError();
    }

    const { roundId } = request.body as CreateChallengeBody;
    const round = await db.round.findUnique({
      where: { id: roundId },
      select: { game: { select: { playerTokenHash: true } } },
    });
    if (!round || round.game.playerTokenHash !== hashPlayerToken(rawToken)) {
      throw new GameNotFoundError();
    }
  };
}

/**
 * Auth hook for POST /api/challenges/:challengeId/entries: the result
 * referenced in the BODY must belong to the player token. A missing/unknown
 * token or result is reported as 404 (ADR-0011).
 */
function requireResultOwnerByBody(
  db: PrismaClient,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request) => {
    const rawToken = request.headers['x-player-token'];
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new GameNotFoundError();
    }

    const { resultId } = request.body as CreateEntryBody;
    const result = await db.result.findUnique({
      where: { id: resultId },
      select: {
        round: { select: { game: { select: { playerTokenHash: true } } } },
      },
    });
    if (
      !result ||
      result.round.game.playerTokenHash !== hashPlayerToken(rawToken)
    ) {
      throw new GameNotFoundError();
    }
  };
}

/** Register the challenge routes. `db` is injectable for tests. */
export function registerChallengesRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.post(
    '/api/challenges',
    {
      preHandler: requireRoundOwnerByBody(db),
      schema: {
        body: CreateChallengeBody,
        response: { 201: CreateChallengeResponse },
      },
    },
    async (request, reply) => {
      const { roundId } = request.body as CreateChallengeBody;
      const view = await createChallenge(roundId, db);
      reply.code(201);
      return view;
    },
  );

  app.post(
    '/api/challenges/:challengeId/join',
    {
      // Phase C: anonymous resource creation that may also trigger an
      // Open-Meteo call via joinChallenge's round build — bound abuse.
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        params: ChallengeIdParams,
        body: JoinChallengeBody,
        response: { 201: JoinChallengeResponse },
      },
    },
    async (request, reply) => {
      const { challengeId } = request.params as ChallengeIdParams;
      const body = request.body as JoinChallengeBody;
      const view = await joinChallenge(challengeId, body, db);
      reply.code(201);
      return view;
    },
  );

  app.post(
    '/api/challenges/:challengeId/entries',
    {
      preHandler: requireResultOwnerByBody(db),
      schema: {
        params: ChallengeIdParams,
        body: CreateEntryBody,
        response: { 201: CreateEntryResponse },
      },
    },
    async (request, reply) => {
      const { challengeId } = request.params as ChallengeIdParams;
      const body = request.body as CreateEntryBody;
      const rawToken = request.headers['x-player-token'];
      if (typeof rawToken !== 'string' || rawToken.length === 0) {
        throw new GameNotFoundError();
      }
      const view = await addEntry(challengeId, body, db, rawToken);
      reply.code(201);
      return view;
    },
  );

  app.get(
    '/api/challenges/:challengeId/leaderboard',
    {
      schema: {
        params: ChallengeIdParams,
        response: { 200: LeaderboardResponse },
      },
    },
    async (request) => {
      const { challengeId } = request.params as ChallengeIdParams;
      return getLeaderboard(challengeId, db);
    },
  );
}
