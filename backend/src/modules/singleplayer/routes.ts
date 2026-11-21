/**
 * Singleplayer routes. HTTP validation and response mapping only — the
 * orchestration lives in `service.ts` (R20), while game rules live in
 * `domain/`. `db`, the provider, locator and weather lookup stay injectable
 * for tests.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';

import { prisma } from '../../db/prisma.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { readTokenHeader } from '../../plugins/auth.js';
import { optionalSessionUserId } from '../auth/session.js';
import { IntelligenceResponse } from '../intelligence/contract.js';
import {
  Candidate,
  Coordinates,
  Difficulty as DifficultyLevel,
  ExtraDataAccess,
} from '../../contracts/shared.js';
import {
  createSingleplayerService,
  type SingleplayerServiceOptions,
} from './service.js';

const PublicRound = Type.Object({
  id: Type.String(),
  number: Type.Integer(),
  panoId: Type.String(),
  candidates: Type.Optional(Type.Array(Candidate)),
  startedAt: Type.Union([Type.String(), Type.Null()]),
  endsAt: Type.Union([Type.String(), Type.Null()]),
  attemptsUsed: Type.Integer(),
  attemptsTotal: Type.Integer(),
  extraData: ExtraDataAccess,
});
const Result = Type.Object({
  roundId: Type.String(),
  number: Type.Integer(),
  actual: Coordinates,
  guess: Type.Union([Coordinates, Type.Null()]),
  distanceKm: Type.Union([Type.Number(), Type.Null()]),
  score: Type.Integer(),
  extraDataPointsSpent: Type.Integer(),
});
const GuessResponse = Type.Object({
  finalized: Type.Boolean(),
  attemptsRemaining: Type.Integer(),
  result: Type.Optional(Result),
});
const Session = Type.Object({
  id: Type.String(),
  difficulty: DifficultyLevel,
  totalScore: Type.Integer(),
  activeRound: Type.Union([PublicRound, Type.Null()]),
  results: Type.Array(Result),
});
const Params = Type.Object({
  gameId: Type.String({ minLength: 1, maxLength: 100 }),
});

/** Read the client-held player token; the service maps missing to a 404. */
function playerToken(request: FastifyRequest): string | undefined {
  return readTokenHeader(request, 'x-player-token');
}

export function registerSingleplayerRoutes(
  app: FastifyInstance,
  options: SingleplayerServiceOptions = {},
): void {
  const db = options.db ?? prisma;
  const service = createSingleplayerService(options);
  const limited = { rateLimit: RATE_LIMITS.standard };

  app.get(
    '/api/singleplayer/config',
    {
      schema: {
        response: {
          200: Type.Object({
            available: Type.Boolean(),
            provider: Type.Literal('google'),
            serverKeyConfigured: Type.Boolean(),
          }),
        },
      },
    },
    async () => ({
      available: service.available,
      provider: 'google' as const,
      serverKeyConfigured: service.serverKeyConfigured,
    }),
  );
  app.post(
    '/api/singleplayer/games',
    {
      config: limited,
      schema: {
        response: {
          201: Type.Object({ id: Type.String(), playerToken: Type.String() }),
          503: Type.Object({
            error: Type.Object({ code: Type.String(), message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!service.available)
        return reply.code(503).send({
          error: {
            code: 'MISSING_SERVER_KEY',
            message:
              'GOOGLE_MAPS_SERVER_API_KEY is missing. Configure the server key and restart the backend.',
          },
        });
      const body = request.body as { difficulty?: unknown } | undefined;
      // R18: capture the account once, so archival does not depend on the
      // session cookie still being valid when the final round ends.
      const ownerUserId = await optionalSessionUserId(request, db);
      const game = await service.createGame({
        difficulty: body?.difficulty,
        ownerUserId: ownerUserId ?? null,
      });
      return reply.code(201).send(game);
    },
  );
  app.get<{ Params: { gameId: string } }>(
    '/api/singleplayer/games/:gameId',
    {
      config: limited,
      schema: { params: Params, response: { 200: Session } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return service.getSession(request.params.gameId, playerToken(request));
    },
  );
  app.delete<{ Params: { gameId: string } }>(
    '/api/singleplayer/games/:gameId',
    {
      config: limited,
      schema: { params: Params },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      // Finalizes ("Ends") the session: the player explicitly chose to stop
      // rather than let it expire naturally. A hard delete cascades
      // StreetRound (see schema) but never touches GameResult (R18).
      await service.deleteGame(request.params.gameId, playerToken(request));
      reply.code(204);
    },
  );
  app.post<{ Params: { gameId: string } }>(
    '/api/singleplayer/games/:gameId/rounds',
    {
      config: limited,
      schema: { params: Params, response: { 200: PublicRound } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return service.startRound(request.params.gameId, playerToken(request));
    },
  );
  app.get<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/intelligence',
    {
      config: limited,
      schema: {
        params: Type.Object({
          gameId: Type.String({ minLength: 1, maxLength: 100 }),
          roundId: Type.String({ minLength: 1, maxLength: 100 }),
        }),
        querystring: Type.Object({}, { additionalProperties: false }),
        response: { 200: IntelligenceResponse },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      return service.getRoundIntelligence(
        request.params.gameId,
        request.params.roundId,
        playerToken(request),
      );
    },
  );
  app.put<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/selection',
    {
      config: limited,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        body: Coordinates,
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      await service.saveSelection(
        request.params.gameId,
        request.params.roundId,
        playerToken(request),
        request.body as { lat: number; lon: number },
      );
      reply.code(204);
    },
  );
  app.post<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/unlock',
    {
      config: limited,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        response: { 200: PublicRound },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return service.unlockExtraData(
        request.params.gameId,
        request.params.roundId,
        playerToken(request),
      );
    },
  );
  app.post<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/retry',
    {
      config: limited,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        response: { 200: PublicRound },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return service.retryRound(
        request.params.gameId,
        request.params.roundId,
        playerToken(request),
      );
    },
  );
  app.post<{
    Params: { gameId: string; roundId: string };
    Body: { lat: number; lon: number; final?: boolean };
  }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/guess',
    {
      // Reject nulls and strings before AJV's default numeric coercion.
      preValidation: async (request) => {
        const body = request.body;
        if (
          !body ||
          typeof body.lat !== 'number' ||
          typeof body.lon !== 'number' ||
          !Number.isFinite(body.lat) ||
          !Number.isFinite(body.lon)
        ) {
          throw Object.assign(
            new Error('Guess coordinates must be finite numbers.'),
            { statusCode: 400 },
          );
        }
      },
      config: limited,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        body: Type.Object({
          lat: Type.Number({ minimum: -90, maximum: 90 }),
          lon: Type.Number({ minimum: -180, maximum: 180 }),
          final: Type.Optional(Type.Boolean()),
        }),
        response: { 200: GuessResponse },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return service.submitGuess(
        request.params.gameId,
        request.params.roundId,
        playerToken(request),
        request.body,
      );
    },
  );
}
