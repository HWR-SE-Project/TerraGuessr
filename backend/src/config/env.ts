export interface Env {
  databaseUrl: string;
  port: number;
  /** false disables CORS entirely (same-origin only) — the safe default (Phase C). */
  corsOrigin: string | false;
  adminApiToken: string;
  openMeteoBaseUrl: string;
  logLevel: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_OPEN_METEO_BASE_URL = 'https://api.open-meteo.com';
const DEFAULT_LOG_LEVEL = 'info';

function parsePort(raw: string | undefined): number {
  const port = Number(raw ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }
  return port;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    databaseUrl,
    port: parsePort(env.PORT),
    // No wildcard default (Phase C): an unset CORS_ORIGIN disables
    // cross-origin requests entirely rather than allowing any origin.
    // docker-compose.*.yml always sets this explicitly for real deployments.
    corsOrigin: env.CORS_ORIGIN?.trim() || false,
    adminApiToken: env.ADMIN_API_TOKEN ?? '',
    openMeteoBaseUrl:
      env.OPEN_METEO_BASE_URL?.trim() || DEFAULT_OPEN_METEO_BASE_URL,
    logLevel: env.LOG_LEVEL?.trim() || DEFAULT_LOG_LEVEL,
  };
}
