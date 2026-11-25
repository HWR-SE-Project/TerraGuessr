export interface Env {
  databaseUrl: string;
  /** NODE_ENV as provided by the runtime; drives production-only safeguards. */
  nodeEnv: string;
  port: number;
  /** false disables CORS entirely (same-origin only) — the safe default (Phase C). */
  corsOrigin: string | false;
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
  /**
   * Fastify `trustProxy` setting. `true` trusts every hop, a number trusts that
   * many proxies, and any other string is treated as a comma-separated
   * address/subnet list (proxy-addr syntax). Keep this scoped to the actual
   * reverse proxy so client IPs cannot be spoofed.
   */
  trustProxy: boolean | number | string;
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

/**
 * `TRUST_PROXY` accepts `true`/`false`, a hop count, or a comma-separated
 * proxy-addr list. Defaults to `false`: never trust forwarded headers unless
 * the deployment explicitly says which proxy sits in front of the app.
 */
function parseTrustProxy(raw: string | undefined): boolean | number | string {
  const value = raw?.trim();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    databaseUrl,
    nodeEnv: env.NODE_ENV?.trim() || 'development',
    port: parsePort(env.PORT),
    // No wildcard default (Phase C): an unset CORS_ORIGIN disables
    // cross-origin requests entirely rather than allowing any origin.
    // docker-compose.*.yml always sets this explicitly for real deployments.
    corsOrigin: env.CORS_ORIGIN?.trim() || false,
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
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
}
