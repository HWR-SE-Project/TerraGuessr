/**
 * Rounds routes (B-06). Registered by `registerRoundsRoutes` from app.ts.
 * Ownership is enforced via ADR-0011 (X-Player-Token → 404, never 401).
 */

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { GameIdParams } from '../../contracts/games.js';
import {
  RoundIdParams,
  RoundView,
  StartRoundBody,
} from '../../contracts/rounds.js';
import {
  GuessResultResponse,
  SubmitGuessBody,
} from '../../contracts/results.js';
import {
  GameNotFoundError,
  hashPlayerToken,
  requirePlayerToken,
} from '../../plugins/auth.js';
import { OpenMeteoClient } from '../weather/client.js';
import type { WeatherClient } from '../weather/types.js';
import { submitGuess } from './guess.js';
import { finishRoundAttempts, submitRoundAttempt } from './attempts.js';
import { getRoundView, startRound } from './service.js';
import { unlockAdditionalData } from './unlock.js';

interface RoundIdRouteParams {
  roundId?: string;
}

/** Auth hook for round-owned routes: resolves the parent game and compares hashes. */
function requireRoundOwner(
  db: PrismaClient,
): (
  request: FastifyRequest<{ Params: RoundIdRouteParams }>,
  reply: FastifyReply,
) => Promise<void> {
  return async (request) => {
    const rawToken = request.headers['x-player-token'];
    const roundId = request.params.roundId;

    if (typeof rawToken !== 'string' || rawToken.length === 0 || !roundId) {
      throw new GameNotFoundError();
    }

    const round = await db.round.findUnique({
      where: { id: roundId },
      select: { game: { select: { playerTokenHash: true } } },
    });

    if (!round || round.game.playerTokenHash !== hashPlayerToken(rawToken)) {
      throw new GameNotFoundError();
    }
  };
}

/** Register the rounds routes. `db` and `weatherClient` are injectable for tests. */
export function registerRoundsRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
  weatherClient: WeatherClient = new OpenMeteoClient(),
): void {
  app.post(
    '/api/games/:gameId/rounds',
    {
      onRequest: requirePlayerToken(db),
      // Phase C: calls the external Open-Meteo API — expensive, bound abuse.
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        params: GameIdParams,
        body: StartRoundBody,
        response: { 201: RoundView },
      },
    },
    async (request, reply) => {
      const { gameId } = request.params as GameIdParams;
      const body = request.body as StartRoundBody;
      const view = await startRound(
        gameId,
        body.selectionMode,
        db,
        weatherClient,
      );
      reply.code(201);
      return view;
    },
  );

  app.get(
    '/api/rounds/:roundId',
    {
      onRequest: requireRoundOwner(db),
      schema: {
        params: RoundIdParams,
        response: { 200: RoundView },
      },
    },
    async (request) => {
      const { roundId } = request.params as RoundIdParams;
      return getRoundView(roundId, db);
    },
  );

  app.post(
    '/api/rounds/:roundId/guess',
    {
      onRequest: requireRoundOwner(db),
      schema: {
        params: RoundIdParams,
        body: SubmitGuessBody,
        response: { 200: GuessResultResponse },
      },
    },
    async (request) => {
      const { roundId } = request.params as RoundIdParams;
      const body = request.body as SubmitGuessBody;
      return submitGuess(roundId, body, db);
    },
  );

  app.post('/api/rounds/:roundId/attempts', {
    onRequest: requireRoundOwner(db),
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { params: RoundIdParams, body: SubmitGuessBody },
  }, async (request) => {
    const { roundId } = request.params as RoundIdParams;
    return submitRoundAttempt(roundId, request.body as SubmitGuessBody, db);
  });

  app.post('/api/rounds/:roundId/intelligence/unlock', {
    onRequest: requireRoundOwner(db),
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { params: RoundIdParams, response: { 200: RoundView } },
  }, async (request) => {
    const { roundId } = request.params as RoundIdParams;
    return unlockAdditionalData(roundId, db);
  });

  app.post('/api/rounds/:roundId/finish', {
    onRequest: requireRoundOwner(db),
    schema: { params: RoundIdParams },
  }, async (request) => {
    const { roundId } = request.params as RoundIdParams;
    return finishRoundAttempts(roundId, db);
  });
}
