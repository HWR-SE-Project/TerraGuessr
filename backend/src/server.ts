import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const config = loadEnv();
const app = buildApp();

const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port: config.port, host });
} catch (err) {
  app.log.error({ err }, 'Failed to start server');
  process.exit(1);
}
