import type { PrismaClient } from '@prisma/client';
import { createIntelligenceProvider } from './modules/intelligence/service.js';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Type } from '@sinclair/typebox';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { prisma } from './db/prisma.js';
import { registerSingleplayerRoutes } from './modules/singleplayer/routes.js';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerLobbiesRoutes } from './modules/lobbies/routes.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerStatisticsRoutes } from './modules/statistics/routes.js';
import { registerResultsRoutes } from './modules/results/routes.js';
import { GameRulesView } from './contracts/shared.js';
import { gameRulesFor } from './domain/gameRules.js';
import { haversineKm } from './domain/distance.js';
import { FULL_SCORE_KM, MAX_SCORE, ZERO_SCORE_KM, scoreForDistance } from './domain/scoring.js';

const exampleDistanceStepKm = 50;
const gameRulesCatalog = {
  difficulties: {
    easy: gameRulesFor('easy'),
    medium: gameRulesFor('medium'),
    hard: gameRulesFor('hard'),
  },
  scoring: {
    maxScore: MAX_SCORE,
    fullScoreKm: FULL_SCORE_KM,
    zeroScoreKm: ZERO_SCORE_KM,
    exampleDistanceStepKm,
    exampleScores: Array.from(
      { length: Math.floor(ZERO_SCORE_KM / exampleDistanceStepKm) + 1 },
      (_, step) => scoreForDistance(step * exampleDistanceStepKm),
    ),
    londonParisKm: haversineKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 }),
  },
};

const DEFAULT_READY_TIMEOUT_MS = 2_000;

export type ReadinessDb = Pick<PrismaClient, '$queryRaw'>;

export interface BuildAppOptions {
  /** Injectable DB handle for readiness probe testing. Defaults to singleton prisma. */
  readyDb?: ReadinessDb;
  /** Maximum time to wait for `SELECT 1` during `/api/ready`. */
  readyTimeoutMs?: number;
}

async function checkDatabaseReady(db: ReadinessDb, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Database readiness check timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = loadEnv();
  const readyDb = options.readyDb ?? prisma;
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;

  const app: FastifyInstance = Fastify({
    logger: { level: config.logLevel },
    // Use the real client address for rate limits and redirect/origin checks.
    // Defaults to false; deployments behind Caddy/nginx set TRUST_PROXY.
    // Fastify's types omit numeric hop counts even though proxy-addr supports them.
    trustProxy: config.trustProxy as boolean | string | string[],
  });

  registerErrorHandler(app);
  // Phase C: opt-in rate limiting (global: false) — only routes that set
  // `config.rateLimit` are limited; see lobbies and auth routes for the
  // expensive/sensitive ones (anonymous resource creation, auth, Open-Meteo calls).
  // Must be awaited: @fastify/rate-limit reads route config via an `onRoute`
  // hook it installs during its own (async) registration. Routes declared
  // before that hook is actually attached are invisible to it — fire-and-
  // forget registration silently dropped rate limiting on every route.
  await app.register(rateLimit, {
    global: false,
    max: 30,
    timeWindow: '1 minute',
  });
  // Register CORS before routes so its hooks are active for every endpoint.
  // An unset CORS_ORIGIN resolves to false (same-origin only).
  await app.register(cors, { origin: config.corsOrigin });
  registerAuthRoutes(app, { config });
  registerStatisticsRoutes(app);
  registerResultsRoutes(app);
  const intelligence = createIntelligenceProvider({
    baseUrl: config.openMeteoBaseUrl,
    apiKey: config.openMeteoApiKey,
  });
  registerLobbiesRoutes(app, undefined, { intelligence });
  registerSingleplayerRoutes(app, { intelligence });

  app.get('/api/game-rules', {
    schema: {
      response: {
        200: Type.Object({
          difficulties: Type.Object({ easy: GameRulesView, medium: GameRulesView, hard: GameRulesView }),
          scoring: Type.Object({
            maxScore: Type.Integer(),
            fullScoreKm: Type.Integer(),
            zeroScoreKm: Type.Integer(),
            exampleDistanceStepKm: Type.Integer(),
            exampleScores: Type.Array(Type.Integer()),
            londonParisKm: Type.Number(),
          }),
        }),
      },
    },
  }, async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return gameRulesCatalog;
  });

  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            time: Type.String(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      time: new Date().toISOString(),
    }),
  );

  app.get(
    '/api/ready',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            db: Type.Literal('ok'),
            time: Type.String(),
          }),
          503: Type.Object({
            status: Type.Literal('unavailable'),
            db: Type.Literal('unavailable'),
            time: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const time = new Date().toISOString();
      try {
        await checkDatabaseReady(readyDb, readyTimeoutMs);
        return { status: 'ok' as const, db: 'ok' as const, time };
      } catch (err) {
        request.log.warn({ err }, 'readiness check failed');
        reply.code(503);
        return { status: 'unavailable' as const, db: 'unavailable' as const, time };
      }
    },
  );

  return app;
}
