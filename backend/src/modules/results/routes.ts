import { Type } from '@sinclair/typebox';
import type { Difficulty, GameMode as PrismaGameMode, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { prisma } from '../../db/prisma.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { FULL_SCORE_KM, MAX_SCORE } from '../../domain/scoring.js';
import { settleTimedOutResultsForUser } from '../../domain/settlement.js';
import { requireSessionUser } from '../auth/session.js';
import {
  Coordinates,
  Difficulty as DifficultyLevel,
} from '../../contracts/shared.js';

const GameMode = Type.Union([Type.Literal('solo'), Type.Literal('multiplayer')]);
const ResultRow = Type.Object(
  {
    id: Type.String(),
    roundNumber: Type.Integer(),
    actual: Coordinates,
    guess: Type.Union([Coordinates, Type.Null()]),
    distanceKm: Type.Union([Type.Number(), Type.Null()]),
    score: Type.Integer(),
    placeName: Type.Union([Type.String(), Type.Null()]),
    biome: Type.Union([Type.String(), Type.Null()]),
    weather: Type.Union([Type.String(), Type.Null()]),
    temperatureBand: Type.Union([Type.String(), Type.Null()]),
    attemptsUsed: Type.Union([Type.Integer(), Type.Null()]),
    extraDataUnlocked: Type.Union([Type.Boolean(), Type.Null()]),
    extraDataPointsSpent: Type.Union([Type.Integer(), Type.Null()]),
    elapsedSeconds: Type.Union([Type.Integer(), Type.Null()]),
    createdAt: Type.String(),
  },
  { additionalProperties: false },
);
const Match = Type.Object(
  {
    matchId: Type.String(),
    sessionId: Type.String(),
    mode: GameMode,
    difficulty: DifficultyLevel,
    playedAt: Type.String(),
    totalScore: Type.Integer(),
    averageScore: Type.Integer(),
    perfectCount: Type.Integer(),
    matchPlacement: Type.Union([Type.Integer(), Type.Null()]),
    matchPlayerCount: Type.Union([Type.Integer(), Type.Null()]),
    results: Type.Array(ResultRow),
  },
  { additionalProperties: false },
);
const Response = Type.Object(
  {
    matches: Type.Array(Match),
    total: Type.Integer(),
    offset: Type.Integer(),
    limit: Type.Integer(),
  },
  { additionalProperties: false },
);
const Query = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
    mode: Type.Optional(GameMode),
    difficulty: Type.Optional(DifficultyLevel),
  },
  { additionalProperties: false },
);

interface ResultQuery {
  limit?: number;
  offset?: number;
  mode?: PrismaGameMode;
  difficulty?: Difficulty;
}

/**
 * R18 result history for the signed-in player. The durable archive is only
 * readable through the caller's own account; there is no cross-player lookup.
 * Matches are grouped by `matchId`, which is stable across lobby rematches.
 */
export function registerResultsRoutes(
  app: FastifyInstance,
  db: PrismaClient = prisma,
): void {
  app.get<{ Querystring: ResultQuery }>(
    '/api/me/results',
    {
      config: { rateLimit: RATE_LIMITS.read },
      schema: {
        querystring: Query,
        response: { 200: Response },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const user = await requireSessionUser(request, db);
      // R08/R18: settle any unattended timed-out rounds for this account before
      // reading history (multiplayer rounds settle only once every member timed out).
      await settleTimedOutResultsForUser(db, user.id);
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      const modeFilter = request.query.mode;
      const difficultyFilter = request.query.difficulty;

      const where = {
        userId: user.id,
        ...(modeFilter ? { mode: modeFilter } : {}),
        ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
      };

      const [groups, distinctMatchGroups] = await Promise.all([
        db.gameResult.groupBy({
          by: ['matchId'],
          where,
          _max: { createdAt: true },
          orderBy: { _max: { createdAt: 'desc' } },
          take: limit,
          skip: offset,
        }),
        db.gameResult.groupBy({
          by: ['matchId'],
          where,
        }),
      ]);
      const matchIds = groups.map((group) => group.matchId);
      const rows =
        matchIds.length === 0
          ? []
          : await db.gameResult.findMany({
              where: { ...where, matchId: { in: matchIds } },
              orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
            });
      const byMatch = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byMatch.get(row.matchId);
        if (list) list.push(row);
        else byMatch.set(row.matchId, [row]);
      }
      const matches = matchIds.flatMap((matchId) => {
        const results = byMatch.get(matchId);
        const first = results?.[0];
        if (!results || !first) return [];
        const totalScore = results.reduce((sum, result) => sum + result.score, 0);
        const averageScore = Math.round(totalScore / results.length);
        const perfectCount = results.filter(
          (r) =>
            r.score >= MAX_SCORE ||
            (r.distanceKm !== null && Math.round(r.distanceKm * 10) / 10 <= FULL_SCORE_KM),
        ).length;
        const playedAt = results.reduce(
          (latest, result) => (result.createdAt > latest ? result.createdAt : latest),
          first.createdAt,
        );
        const placedRow = results.find(
          (r) => r.matchPlacement !== null && r.matchPlayerCount !== null,
        );
        return [
          {
            matchId,
            sessionId: first.sessionId,
            mode: first.mode,
            difficulty: first.difficulty,
            playedAt: playedAt.toISOString(),
            totalScore,
            averageScore,
            perfectCount,
            matchPlacement: placedRow?.matchPlacement ?? null,
            matchPlayerCount: placedRow?.matchPlayerCount ?? null,
            results: results.map((result) => ({
              id: result.id,
              roundNumber: result.roundNumber,
              actual: { lat: result.actualLat, lon: result.actualLon },
              guess:
                result.guessLat === null || result.guessLon === null
                  ? null
                  : { lat: result.guessLat, lon: result.guessLon },
              distanceKm: result.distanceKm,
              score: result.score,
              placeName: result.placeName,
              biome: result.biome,
              weather: result.weather,
              temperatureBand: result.temperatureBand,
              attemptsUsed: result.attemptsUsed,
              extraDataUnlocked: result.extraDataUnlocked,
              extraDataPointsSpent: result.extraDataPointsSpent,
              elapsedSeconds: result.elapsedSeconds,
              createdAt: result.createdAt.toISOString(),
            })),
          },
        ];
      });

      return {
        matches,
        total: distinctMatchGroups.length,
        offset,
        limit,
      };
    },
  );
}
