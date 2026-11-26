import type { PrismaClient } from '@prisma/client';
import { createIntelligenceProvider } from './modules/intelligence/service.js';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Type } from '@sinclair/typebox';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { prisma } from './db/prisma.js';
import {
  DEFAULT_ROUNDS_TOTAL,
  MAX_ROUNDS_TOTAL,
  MIN_ROUNDS_TOTAL,
  RATE_LIMITS,
} from './config/constants.js';
import { registerSingleplayerRoutes } from './modules/singleplayer/routes.js';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { createStrictBodySchemaController } from './plugins/validation.js';
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
  rounds: {
    min: MIN_ROUNDS_TOTAL,
    max: MAX_ROUNDS_TOTAL,
    default: DEFAULT_ROUNDS_TOTAL,
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
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-player-token"]',
          'req.headers["x-lobby-token"]',
          'res.headers["set-cookie"]',
          '*.password',
          '*.currentPassword',
          '*.token',
          '*.playerToken',
          '*.lobbyToken',
          '*.apikey',
        ],
        censor: '[REDACTED]',
      },
    },
    // Use the real client address for rate limits and redirect/origin checks.
    // Defaults to false; deployments behind Caddy/nginx set TRUST_PROXY.
    // Fastify's types omit numeric hop counts even though proxy-addr supports them.
    trustProxy: config.trustProxy as boolean | string | string[],
    // Keep coercion for params/querystring/headers while rejecting invalid
    // JSON body types (e.g. `{ lat: null }` coerced to `0`).
    schemaController: createStrictBodySchemaController(),
  });

  registerErrorHandler(app);
  // Global baseline rate limit protects every route by default while letting
  // individual endpoints apply tighter limits (auth, creation) or opt out
  // explicitly (`/api/health`, `/api/ready`). Must be awaited so the `onRoute`
  // hook is active before routes are registered.
  await app.register(rateLimit, {
    global: true,
    max: RATE_LIMITS.globalDefault.max,
    timeWindow: RATE_LIMITS.globalDefault.timeWindow,
  });
  // Register CORS before routes so its hooks are active for every endpoint.
  // An unset CORS_ORIGIN resolves to false (same-origin only); when configured,
  // allow credentials to match frontend `credentials: 'include'`.
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: Boolean(config.corsOrigin),
    exposedHeaders: ['Retry-After'],
  });
  registerAuthRoutes(app, { config });
  registerStatisticsRoutes(app);
  registerResultsRoutes(app);
  const intelligence = createIntelligenceProvider({
    baseUrl: config.openMeteoBaseUrl,
    apiKey: config.openMeteoApiKey,
    log: app.log,
    ...(config.metNoBaseUrl
      ? {
          fallbackWeatherBaseUrl: config.metNoBaseUrl,
          fallbackUserAgent: `TerraGuessr/0.1 (+${config.appBaseUrl ?? 'https://github.com/TerraGuessr'})`,
        }
      : {}),
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
          rounds: Type.Object({
            min: Type.Integer(),
            max: Type.Integer(),
            default: Type.Integer(),
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
      config: { rateLimit: false },
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
      config: { rateLimit: false },
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
