export interface Env {
  databaseUrl: string;
  googleMapsServerKey?: string;
  port: number;
  /** false disables CORS entirely (same-origin only) — the safe default (Phase C). */
  corsOrigin: string | false;
  adminApiToken: string;
  openMeteoBaseUrl: string;
  openMeteoApiKey?: string;
  logLevel: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  appBaseUrl?: string;
  smtpUrl?: string;
  smtpFrom?: string;
  sessionCookieSecure: boolean;
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
    googleMapsServerKey: env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || undefined,
    port: parsePort(env.PORT),
    // No wildcard default (Phase C): an unset CORS_ORIGIN disables
    // cross-origin requests entirely rather than allowing any origin.
    // docker-compose.*.yml always sets this explicitly for real deployments.
    corsOrigin: env.CORS_ORIGIN?.trim() || false,
    adminApiToken: env.ADMIN_API_TOKEN ?? '',
    openMeteoBaseUrl:
      env.OPEN_METEO_BASE_URL?.trim() || DEFAULT_OPEN_METEO_BASE_URL,
    openMeteoApiKey: env.OPEN_METEO_API_KEY?.trim() || undefined,
    logLevel: env.LOG_LEVEL?.trim() || DEFAULT_LOG_LEVEL,
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() || undefined,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI?.trim() || undefined,
    appBaseUrl: env.APP_BASE_URL?.trim() || undefined,
    smtpUrl: env.SMTP_URL?.trim() || undefined,
    smtpFrom: env.SMTP_FROM?.trim() || undefined,
    sessionCookieSecure:
      env.NODE_ENV === 'production' || env.SESSION_COOKIE_SECURE === 'true',
  };
}
