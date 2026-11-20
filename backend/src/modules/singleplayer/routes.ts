import { Prisma } from '@prisma/client';
import type { Difficulty, PrismaClient, StreetRound } from '@prisma/client';
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
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import { selectValidatedTarget } from './locationSelection.js';
import { buildCandidates } from './candidates.js';
import type { CandidateOption } from './candidates.js';
import { prefetchNextStreetRound } from './prefetch.js';

import {
  IntelligenceResponse,
  type GeographicIntelligence,
} from '../intelligence/contract.js';
import { createIntelligenceProvider } from '../intelligence/service.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
function parseDifficulty(value: unknown): Difficulty {
  return typeof value === 'string' &&
    (DIFFICULTIES as readonly string[]).includes(value)
    ? (value as Difficulty)
    : 'medium';
}

const Coordinates = Type.Object(
  {
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);
const DifficultyLevel = Type.Union([
  Type.Literal('easy'),
  Type.Literal('medium'),
  Type.Literal('hard'),
]);
const Candidate = Type.Object({
  id: Type.String(),
  name: Type.String(),
  region: Type.String(),
  lat: Type.Number(),
  lon: Type.Number(),
});
const PublicRound = Type.Object({
  id: Type.String(),
  number: Type.Integer(),
  panoId: Type.String(),
  candidates: Type.Optional(Type.Array(Candidate)),
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
  difficulty: DifficultyLevel,
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
  const candidates = round.candidatesJson as unknown as
    | CandidateOption[]
    | null;
  return {
    id: round.id,
    number: round.number,
    panoId: round.panoId,
    ...(candidates && candidates.length ? { candidates } : {}),
  };
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
    async (request, reply) => {
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
      const body = request.body as { difficulty?: unknown } | undefined;
      const playerToken = generatePlayerToken();
      const game = await db.streetGame.create({
        data: {
          playerTokenHash: hashPlayerToken(playerToken),
          difficulty: parseDifficulty(body?.difficulty),
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
        difficulty: game.difficulty,
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
      const usedIndices = game.rounds.map((r) => r.targetIndex);
      const nextNumber = game.rounds.length + 1;
      async function persistRound(target: PanoramaTarget) {
        const candidates =
          game.difficulty === 'easy'
            ? buildCandidates(target.targetIndex, usedIndices)
            : null;
        try {
          const round = await db.streetRound.create({
            data: {
              gameId: game.id,
              number: nextNumber,
              panoId: target.panoId,
              targetIndex: target.targetIndex,
              targetLat: target.lat,
              targetLon: target.lon,
              ...(candidates
                ? {
                    candidatesJson:
                      candidates as unknown as Prisma.InputJsonValue,
                  }
                : {}),
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
            where: { gameId_number: { gameId: game.id, number: nextNumber } },
          });
          return publicRound(existing);
        }
      }
      try {
        // R12 fast path: consume a cached prefetched target if one is ready.
        // The conditional update both claims it and prevents a concurrent
        // request from double-consuming the same prefetch.
        if (game.nextPanoId != null) {
          const claimed = await db.streetGame.updateMany({
            where: { id: game.id, nextPanoId: game.nextPanoId },
            data: {
              nextTargetIndex: null,
              nextPanoId: null,
              nextTargetLat: null,
              nextTargetLon: null,
            },
          });
          if (claimed.count)
            return await persistRound({
              panoId: game.nextPanoId,
              targetIndex: game.nextTargetIndex!,
              lat: game.nextTargetLat!,
              lon: game.nextTargetLon!,
            });
        }
        // R03/R13: only accept a location whose mandatory weather data is
        // available, automatically trying another when it is not.
        const target = await selectValidatedTarget(
          usedIndices,
          provider,
          intelligence,
        );
        return await persistRound(target);
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
      const usedIndices = game.rounds.map((r) => r.targetIndex);
      // R03/R13: a retry (whether triggered by missing coverage or missing
      // weather data) only accepts a location with valid weather too.
      const target = await selectValidatedTarget(
        usedIndices,
        provider,
        intelligence,
      );
      const candidates =
        game.difficulty === 'easy'
          ? buildCandidates(target.targetIndex, usedIndices)
          : null;
      const changed = await db.streetRound.updateMany({
        where: { id: current.id, score: null, panoId: current.panoId },
        data: {
          panoId: target.panoId,
          targetIndex: target.targetIndex,
          targetLat: target.lat,
          targetLon: target.lon,
          candidatesJson: candidates
            ? (candidates as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
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
      const score = scoreForDistance(distanceKm);
      const updated = await db.streetRound.updateMany({
        where: { id: round.id, score: null, panoId: round.panoId },
        data: {
          guessLat: guess.lat,
          guessLon: guess.lon,
          distanceKm,
          score,
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
      if (updated.count) {
        // R18: durable archive, decoupled from the 24h session-expiry
        // cleanup. Best-effort — never blocks the player from seeing their
        // result if the archive write itself fails.
        await db.streetResult
          .create({
            data: {
              gameId: game.id,
              roundId: round.id,
              roundNumber: round.number,
              difficulty: game.difficulty,
              actualLat: actual.lat,
              actualLon: actual.lon,
              guessLat: guess.lat,
              guessLon: guess.lon,
              distanceKm,
              score,
            },
          })
          .catch(() => {});
        // R12: best-effort prefetch of the following round, never awaited.
        const completedRounds =
          game.rounds.filter((r) => r.score !== null).length + 1;
        if (completedRounds < game.roundsTotal)
          void prefetchNextStreetRound(game.id, db, provider, intelligence);
      }
      return result(locked, actual);
    },
  );
}
