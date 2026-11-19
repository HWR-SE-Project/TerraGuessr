import { Prisma } from '@prisma/client';
import type { PrismaClient, StreetRound } from '@prisma/client';
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyError,
  FastifyReply,
} from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../../db/prisma.js';
import {
  generatePlayerToken,
  hashPlayerToken,
  GameNotFoundError,
} from '../../plugins/auth.js';
import type { LatLon } from '../../domain/distance.js';
import { haversineKm } from '../../domain/distance.js';
import { scoreForDistance } from '../../domain/scoring.js';
import {
  googlePanoramaProvider,
  googlePanoramaLocator,
  PanoramaError,
} from './provider.js';
import type { PanoramaProvider } from './provider.js';

import {
  IntelligenceResponse,
  type GeographicIntelligence,
} from '../intelligence/contract.js';
import { createIntelligenceProvider } from '../intelligence/service.js';

const Coordinates = Type.Object(
  {
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);
const PublicRound = Type.Object({
  id: Type.String(),
  number: Type.Integer(),
  panoId: Type.String(),
});
const Result = Type.Object({
  roundId: Type.String(),
  number: Type.Integer(),
  actual: Coordinates,
  guess: Coordinates,
  distanceKm: Type.Number(),
  score: Type.Integer(),
});
const Session = Type.Object({
  id: Type.String(),
  roundsTotal: Type.Integer(),
  totalScore: Type.Integer(),
  completed: Type.Boolean(),
  activeRound: Type.Union([PublicRound, Type.Null()]),
  results: Type.Array(Result),
});
const Params = Type.Object({
  gameId: Type.String({ minLength: 1, maxLength: 100 }),
});

function conflict(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 409 });
}
function publicRound(round: StreetRound) {
  return { id: round.id, number: round.number, panoId: round.panoId };
}
function result(round: StreetRound, actual: LatLon) {
  return {
    roundId: round.id,
    number: round.number,
    actual,
    guess: { lat: round.guessLat!, lon: round.guessLon! },
    distanceKm: round.distanceKm!,
    score: round.score!,
  };
}

export function registerSingleplayerRoutes(
  app: FastifyInstance,
  options: {
    key?: string;
    db?: PrismaClient;
    provider?: PanoramaProvider;
    locate?: (panoId: string) => Promise<LatLon>;
    intelligence?: (
      lat: number,
      lon: number,
    ) => Promise<GeographicIntelligence>;
  } = {},
): void {
  const db = options.db ?? prisma;
  const provider = options.provider ?? googlePanoramaProvider(options.key);
  const locate = options.locate ?? googlePanoramaLocator(options.key);
  const intelligence = options.intelligence ?? createIntelligenceProvider();
  const errorHandler = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (error instanceof PanoramaError) {
      return reply.status(503).send({
        error: { code: error.code, message: error.reason },
      });
    }
    return app.errorHandler.call(app, error, request, reply);
  };
  const limited = { rateLimit: { max: 30, timeWindow: '1 minute' } };
  async function owned(
    request: FastifyRequest<{ Params: { gameId: string } }>,
  ) {
    const token = request.headers['x-player-token'];
    if (typeof token !== 'string') throw new GameNotFoundError();
    const game = await db.streetGame.findUnique({
      where: { id: request.params.gameId },
      include: { rounds: { orderBy: { number: 'asc' } } },
    });
    if (
      !game ||
      game.playerTokenHash !== hashPlayerToken(token) ||
      game.expiresAt < new Date()
    )
      throw new GameNotFoundError();
    return game;
  }

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
      available: Boolean(options.key || options.provider),
      provider: 'google' as const,
      serverKeyConfigured: Boolean(options.key),
    }),
  );
  app.post(
    '/api/singleplayer/games',
    {
      config: limited,
      errorHandler,
      schema: {
        response: {
          201: Type.Object({ id: Type.String(), playerToken: Type.String() }),
          503: Type.Object({
            error: Type.Object({ code: Type.String(), message: Type.String() }),
          }),
        },
      },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!options.key && !options.provider)
        return reply.code(503).send({
          error: {
            code: 'MISSING_SERVER_KEY',
            message:
              'GOOGLE_MAPS_SERVER_API_KEY is missing. Configure the server key and restart the backend.',
          },
        });
      await db.streetGame.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      const playerToken = generatePlayerToken();
      const game = await db.streetGame.create({
        data: {
          playerTokenHash: hashPlayerToken(playerToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return reply.code(201).send({ id: game.id, playerToken });
    },
  );
  app.get<{ Params: { gameId: string } }>(
    '/api/singleplayer/games/:gameId',
    {
      config: limited,
      errorHandler,
      schema: { params: Params, response: { 200: Session } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const game = await owned(request);
      const results = await Promise.all(
        game.rounds
          .filter((r) => r.score !== null)
          .map(async (round) => result(round, await locate(round.panoId))),
      );
      const active = game.rounds.find((r) => r.score === null);
      return {
        id: game.id,
        roundsTotal: game.roundsTotal,
        totalScore: results.reduce((sum, r) => sum + r.score, 0),
        completed: results.length === game.roundsTotal,
        activeRound: active ? publicRound(active) : null,
        results,
      };
    },
  );
  app.post<{ Params: { gameId: string } }>(
    '/api/singleplayer/games/:gameId/rounds',
    {
      config: limited,
      errorHandler,
      schema: { params: Params, response: { 200: PublicRound } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const game = await owned(request);
      const active = game.rounds.find((r) => r.score === null);
      if (active) return publicRound(active); // Idempotent retry, including response loss.
      if (game.rounds.length >= game.roundsTotal)
        throw conflict('All rounds are completed.');
      try {
        const target = await provider(game.rounds.map((r) => r.targetIndex));
        try {
          const round = await db.streetRound.create({
            data: {
              gameId: game.id,
              number: game.rounds.length + 1,
              panoId: target.panoId,
              targetIndex: target.targetIndex,
              targetLat: target.lat,
              targetLon: target.lon,
            },
          });
          return publicRound(round);
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          )
            throw error;
          const existing = await db.streetRound.findUniqueOrThrow({
            where: {
              gameId_number: {
                gameId: game.id,
                number: game.rounds.length + 1,
              },
            },
          });
          return publicRound(existing);
        }
      } catch (error) {
        if (error instanceof PanoramaError)
          return reply.code(503).send({
            error: { code: error.code, message: error.reason },
          });
        throw error;
      }
    },
  );
  app.get<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/intelligence',
    {
      config: limited,
      errorHandler,
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
      const game = await owned(request);
      const round = game.rounds.find((r) => r.id === request.params.roundId);
      if (!round) throw new GameNotFoundError();
      if (round.score !== null)
        throw conflict(
          'Environmental clues are only available for the active round.',
        );
      // Resolve the starting panorama on the server. Street View movement and
      // client-supplied coordinates never control the environmental lookup.
      const point = await locate(round.panoId);
      const data = await intelligence(point.lat, point.lon);
      const current = await db.streetRound.findUnique({
        where: { id: round.id },
      });
      if (!current || current.panoId !== round.panoId || current.score !== null)
        throw conflict(
          'The round changed. Request clues for the current round.',
        );
      // Fastify's explicit response schema strips all non-allowlisted fields.
      return data;
    },
  );
  app.post<{ Params: { gameId: string; roundId: string } }>(
    '/api/singleplayer/games/:gameId/rounds/:roundId/retry',
    {
      config: limited,
      errorHandler,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        response: { 200: PublicRound },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const game = await owned(request);
      const current = game.rounds.find((r) => r.id === request.params.roundId);
      if (!current) throw new GameNotFoundError();
      if (current.score !== null)
        throw conflict('A scored round cannot be replaced.');
      const target = await provider(game.rounds.map((r) => r.targetIndex));
      const changed = await db.streetRound.updateMany({
        where: { id: current.id, score: null, panoId: current.panoId },
        data: {
          panoId: target.panoId,
          targetIndex: target.targetIndex,
          targetLat: target.lat,
          targetLon: target.lon,
        },
      });
      if (!changed.count)
        throw conflict(
          'The round changed while its panorama was loading. Resume the expedition.',
        );
      return publicRound(
        await db.streetRound.findUniqueOrThrow({ where: { id: current.id } }),
      );
    },
  );
  app.post<{
    Params: { gameId: string; roundId: string };
    Body: { lat: number; lon: number };
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
      errorHandler,
      schema: {
        params: Type.Object({ gameId: Type.String(), roundId: Type.String() }),
        body: Coordinates,
        response: { 200: Result },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const game = await owned(request);
      const round = game.rounds.find((r) => r.id === request.params.roundId);
      if (!round) throw new GameNotFoundError();
      const guess = request.body;
      const actual = await locate(round.panoId);
      if (round.score !== null) {
        if (round.guessLat === guess.lat && round.guessLon === guess.lon)
          return result(round, actual);
        throw conflict('This guess is already locked.');
      }
      const distanceKm = haversineKm(guess, actual);
      const updated = await db.streetRound.updateMany({
        where: { id: round.id, score: null, panoId: round.panoId },
        data: {
          guessLat: guess.lat,
          guessLon: guess.lon,
          distanceKm,
          score: scoreForDistance(distanceKm),
        },
      });
      const locked = await db.streetRound.findUniqueOrThrow({
        where: { id: round.id },
      });
      if (!updated.count && locked.panoId !== round.panoId)
        throw conflict(
          'The panorama changed. Reload the current round before guessing.',
        );
      if (
        !updated.count &&
        (locked.guessLat !== guess.lat || locked.guessLon !== guess.lon)
      )
        throw conflict('This guess is already locked.');
      return result(locked, actual);
    },
  );
}
