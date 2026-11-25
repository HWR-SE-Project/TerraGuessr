export interface Env {
  databaseUrl: string;
  /** NODE_ENV as provided by the runtime; drives production-only safeguards. */
  nodeEnv: string;
  port: number;
  /** false disables CORS entirely (same-origin only) — the safe default (Phase C). */
  corsOrigin: string | false;
  /** Precomputed origins permitted by same-site mutation checks. */
  allowedOrigins?: ReadonlySet<string>;
  openMeteoBaseUrl: string;
  openMeteoApiKey?: string;
  metNoBaseUrl?: string;
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
const VALID_LOG_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

function parsePort(raw: string | undefined): number {
  const port = Number(raw ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }
  return port;
}

function parseUrl(
  name: string,
  value: string,
  allowedProtocols: readonly string[],
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${name} URL: "${value}"`);
  }
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      `Invalid ${name} protocol "${parsed.protocol}" (expected ${allowedProtocols.join(' or ')})`,
    );
  }
  return parsed;
}

function parseLogLevel(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_LOG_LEVEL;
  if (!VALID_LOG_LEVELS.has(value)) {
    throw new Error(`Invalid LOG_LEVEL value: "${value}"`);
  }
  return value;
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
  parseUrl('DATABASE_URL', databaseUrl, ['postgres:', 'postgresql:']);

  const rawCorsOrigin = env.CORS_ORIGIN?.trim() || undefined;
  const corsOriginUrl = rawCorsOrigin
    ? parseUrl('CORS_ORIGIN', rawCorsOrigin, ['http:', 'https:'])
    : undefined;

  const openMeteoBaseUrl =
    env.OPEN_METEO_BASE_URL?.trim() || DEFAULT_OPEN_METEO_BASE_URL;
  parseUrl('OPEN_METEO_BASE_URL', openMeteoBaseUrl, ['http:', 'https:']);

  const metNoBaseUrl = env.MET_NO_BASE_URL?.trim() || undefined;
  if (metNoBaseUrl) {
    parseUrl('MET_NO_BASE_URL', metNoBaseUrl, ['http:', 'https:']);
  }

  const appBaseUrl = env.APP_BASE_URL?.trim() || undefined;
  const appBaseUrlParsed = appBaseUrl
    ? parseUrl('APP_BASE_URL', appBaseUrl, ['http:', 'https:'])
    : undefined;

  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || undefined;
  const googleRedirectUri = env.GOOGLE_REDIRECT_URI?.trim() || undefined;
  if (googleRedirectUri) {
    parseUrl('GOOGLE_REDIRECT_URI', googleRedirectUri, ['http:', 'https:']);
  }
  if (
    (googleClientId || googleClientSecret) &&
    (!googleClientId || !googleClientSecret || !googleRedirectUri)
  ) {
    throw new Error(
      'Partial Google OAuth configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must all be set together',
    );
  }

  const smtpUrl = env.SMTP_URL?.trim() || undefined;
  const smtpFrom = env.SMTP_FROM?.trim() || undefined;
  if (smtpUrl) {
    parseUrl('SMTP_URL', smtpUrl, ['smtp:', 'smtps:']);
  }
  if (Boolean(smtpUrl) !== Boolean(smtpFrom)) {
    throw new Error(
      'Partial SMTP configuration: SMTP_URL and SMTP_FROM must both be set together',
    );
  }

  const allowedOrigins = new Set<string>();
  if (appBaseUrlParsed) allowedOrigins.add(appBaseUrlParsed.origin);
  if (corsOriginUrl) allowedOrigins.add(corsOriginUrl.origin);

  return {
    databaseUrl,
    nodeEnv: env.NODE_ENV?.trim() || 'development',
    port: parsePort(env.PORT),
    // No wildcard default (Phase C): an unset CORS_ORIGIN disables
    // cross-origin requests entirely rather than allowing any origin.
    // docker-compose.*.yml always sets this explicitly for real deployments.
    corsOrigin: rawCorsOrigin || false,
    allowedOrigins,
    openMeteoBaseUrl,
    openMeteoApiKey: env.OPEN_METEO_API_KEY?.trim() || undefined,
    metNoBaseUrl,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    appBaseUrl,
    smtpUrl,
    smtpFrom,
    sessionCookieSecure:
      env.NODE_ENV === 'production' || env.SESSION_COOKIE_SECURE === 'true',
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
}
