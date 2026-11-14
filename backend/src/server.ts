import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { prisma } from './db/prisma.js';
import { startScheduler } from './scheduler/index.js';

const config = loadEnv();
const app = buildApp();

const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port: config.port, host });

  // Retention purge (R18): once per server process, never in tests.
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    startScheduler(prisma, app.log);
  }
} catch (err) {
  app.log.error({ err }, 'Failed to start server');
  process.exit(1);
}
