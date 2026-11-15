import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { haversineKm } from '../../domain/distance.js';
import { scoreForDistance } from '../../domain/scoring.js';
import { AuthError } from '../auth/service.js';
import { assertSameSiteMutation, requireSessionUser } from '../auth/session.js';
import type { Env } from '../../config/env.js';
import { OpenMeteoClient } from '../weather/client.js';
import type { WeatherClient } from '../weather/types.js';
import { getFreshSnapshot, WeatherUnavailableError } from '../weather/cache.js';

const GuessBody = Type.Object({
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lon: Type.Number({ minimum: -180, maximum: 180 }),
}, { additionalProperties: false });
const DateParams = Type.Object({ date: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }) });

function todayUtc(): string { return new Date().toISOString().slice(0, 10); }
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function getOrCreateToday(db: PrismaClient, weather: WeatherClient) {
  const date = todayUtc();
  let challenge = await db.dailyChallenge.findUnique({ where: { date } });
  if (challenge) return challenge;
  const locations = await db.location.findMany({ where: { isLand: true }, orderBy: { id: 'asc' }, select: { id: true } });
  if (locations.length === 0) throw new AuthError(503, 'Daily locations are unavailable');
  // FNV-1a over the UTC date gives a stable location index across all instances.
  let hash = 2166136261;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const locationId = locations[hash % locations.length]!.id;
  let snapshot;
  try { snapshot = await getFreshSnapshot(db, weather, locationId); }
  catch (error) {
    if (error instanceof WeatherUnavailableError) throw new AuthError(503, 'Daily weather is temporarily unavailable');
    throw error;
  }
  try {
    challenge = await db.dailyChallenge.create({ data: { date, locationId, weatherSnapshotId: snapshot.id } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    challenge = await db.dailyChallenge.findUnique({ where: { date } });
  }
  if (!challenge) throw new AuthError(503, 'Daily challenge could not be initialized');
  return challenge;
}

function resultDto(submission: { id: string; distanceKm: number; score: number; guessLat: number; guessLon: number }, location: { lat: number; lon: number }) {
  return {
    resultId: submission.id,
    distanceKm: submission.distanceKm,
    score: submission.score,
    guess: { lat: submission.guessLat, lon: submission.guessLon },
    actual: { lat: location.lat, lon: location.lon },
  };
}

export function registerDailyRoutes(
  app: FastifyInstance,
  options: { config: Env; db?: PrismaClient; weatherClient?: WeatherClient },
): void {
  const db = options.db ?? prisma;
  const weather = options.weatherClient ?? new OpenMeteoClient();
  app.get('/api/daily/today', async (request) => {
    const user = await requireSessionUser(request, db);
    const challenge = await getOrCreateToday(db, weather);
    const submission = await db.dailySubmission.findUnique({ where: { date_userId: { date: challenge.date, userId: user.id } } });
    const snapshot = await db.weatherSnapshot.findUniqueOrThrow({ where: { id: challenge.weatherSnapshotId } });
    const round = {
      roundId: challenge.date, roundNumber: 1, attemptsTotal: 1, difficulty: 'hard', selectionMode: 'map',
      weather: { temperatureC: snapshot.temperatureC, precipitationMm: snapshot.precipitationMm, humidityPct: snapshot.humidityPct, windSpeedKmh: snapshot.windSpeedKmh },
    };
    if (submission) {
      const location = await db.location.findUniqueOrThrow({ where: { id: challenge.locationId }, select: { lat: true, lon: true } });
      return { date: challenge.date, status: 'completed', round, result: resultDto(submission, location) };
    }
    return {
      date: challenge.date,
      status: 'open',
      round,
    };
  });

  app.post('/api/daily/today/guess', {
    onRequest: (request) => assertSameSiteMutation(request, options.config),
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: GuessBody },
  }, async (request, reply) => {
    const user = await requireSessionUser(request, db);
    const challenge = await getOrCreateToday(db, weather);
    const existing = await db.dailySubmission.findUnique({ where: { date_userId: { date: challenge.date, userId: user.id } } });
    if (existing) throw new AuthError(409, 'Daily challenge already completed');
    const body = request.body as { lat: number; lon: number };
    const location = await db.location.findUniqueOrThrow({ where: { id: challenge.locationId }, select: { lat: true, lon: true } });
    const distanceKm = haversineKm(body, location);
    let submission;
    try {
      submission = await db.dailySubmission.create({ data: { date: challenge.date, userId: user.id, guessLat: body.lat, guessLon: body.lon, distanceKm, score: scoreForDistance(distanceKm) } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AuthError(409, 'Daily challenge already completed');
      throw error;
    }
    reply.code(201);
    return { date: challenge.date, result: resultDto(submission, location) };
  });

  app.get<{ Params: { date: string }; Querystring: { limit?: number; offset?: number } }>('/api/daily/:date/leaderboard', {
    schema: {
      params: DateParams,
      querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })), offset: Type.Optional(Type.Integer({ minimum: 0 })) }),
    },
  }, async (request) => {
    const { date } = request.params;
    const normalizedDate = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(normalizedDate.getTime()) || normalizedDate.toISOString().slice(0, 10) !== date) throw new AuthError(400, 'Invalid UTC date');
    const user = await requireSessionUser(request, db);
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;
    const orderBy = [{ score: 'desc' as const }, { distanceKm: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];
    const [rows, total, own] = await Promise.all([
      db.dailySubmission.findMany({ where: { date }, orderBy, skip: offset, take: limit, include: { user: { select: { displayName: true } } } }),
      db.dailySubmission.count({ where: { date } }),
      db.dailySubmission.findUnique({ where: { date_userId: { date, userId: user.id } } }),
    ]);
    let myRank: number | null = null;
    if (own) myRank = 1 + await db.dailySubmission.count({ where: { date, OR: [
      { score: { gt: own.score } },
      { score: own.score, distanceKm: { lt: own.distanceKm } },
      { score: own.score, distanceKm: own.distanceKm, createdAt: { lt: own.createdAt } },
      { score: own.score, distanceKm: own.distanceKm, createdAt: own.createdAt, id: { lt: own.id } },
    ] } });
    return { date, entries: rows.map((row, index) => ({ rank: offset + index + 1, displayName: row.user.displayName, score: row.score, distanceKm: row.distanceKm })), total, offset, limit, myRank };
  });
}
