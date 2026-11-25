import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { prisma } from './db/prisma.js';
import { startScheduler, stopScheduler, type SchedulerHandle } from './scheduler/index.js';

const SHUTDOWN_TIMEOUT_MS = 8_000;

const config = loadEnv();
const app = await buildApp();

const host = process.env.HOST ?? '0.0.0.0';
let scheduler: SchedulerHandle | undefined;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    app.log.info({ signal }, 'shutdown already in progress');
    return;
  }
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down gracefully');

  const forceExitTimer = setTimeout(() => {
    app.log.fatal({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    await stopScheduler(scheduler);
    await app.close();
    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    app.log.info({ signal }, 'graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimer);
    app.log.error({ err, signal }, 'graceful shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

try {
  await app.listen({ port: config.port, host });

  // Retention purge (R18): once per server process, never in tests.
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    scheduler = startScheduler(prisma, app.log);
  }
} catch (err) {
  app.log.error({ err }, 'Failed to start server');
  process.exit(1);
}
