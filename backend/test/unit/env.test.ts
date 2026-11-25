import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it('defaults CORS to disabled (false) instead of a wildcard', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x' });
    expect(env.corsOrigin).toBe(false);
  });

  it('honors an explicit CORS_ORIGIN', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://x',
      CORS_ORIGIN: 'https://example.com',
    });
    expect(env.corsOrigin).toBe('https://example.com');
  });

  it('defaults PORT to 3000 and validates an explicit one', () => {
    expect(loadEnv({ DATABASE_URL: 'postgresql://x' }).port).toBe(3000);
    expect(
      loadEnv({ DATABASE_URL: 'postgresql://x', PORT: '4321' }).port,
    ).toBe(4321);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', PORT: 'not-a-number' }),
    ).toThrow(/Invalid PORT value/);
  });

  it('does not trust proxy headers by default and parses TRUST_PROXY forms', () => {
    expect(loadEnv({ DATABASE_URL: 'postgresql://x' }).trustProxy).toBe(false);
    expect(loadEnv({ DATABASE_URL: 'postgresql://x', TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(loadEnv({ DATABASE_URL: 'postgresql://x', TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadEnv({ DATABASE_URL: 'postgresql://x', TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadEnv({ DATABASE_URL: 'postgresql://x', TRUST_PROXY: '10.0.0.0/8' }).trustProxy).toBe('10.0.0.0/8');
  });

  it('validates URLs, LOG_LEVEL, and precomputes allowedOrigins at startup', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: 'not-a-url' }),
    ).toThrow(/Invalid DATABASE_URL/);
    expect(() =>
      loadEnv({ DATABASE_URL: 'http://wrong-proto' }),
    ).toThrow(/Invalid DATABASE_URL protocol/);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', CORS_ORIGIN: 'example.com' }),
    ).toThrow(/Invalid CORS_ORIGIN URL/);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', APP_BASE_URL: 'ftp://example.com' }),
    ).toThrow(/Invalid APP_BASE_URL protocol/);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', OPEN_METEO_BASE_URL: 'bad' }),
    ).toThrow(/Invalid OPEN_METEO_BASE_URL URL/);
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', MET_NO_BASE_URL: 'ftp://api.met.no' }),
    ).toThrow(/Invalid MET_NO_BASE_URL protocol/);
    expect(loadEnv({ DATABASE_URL: 'postgresql://x' }).metNoBaseUrl).toBeUndefined();
    expect(
      loadEnv({ DATABASE_URL: 'postgresql://x', MET_NO_BASE_URL: 'https://api.met.no' })
        .metNoBaseUrl,
    ).toBe('https://api.met.no');
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', LOG_LEVEL: 'verbose' }),
    ).toThrow(/Invalid LOG_LEVEL/);

    const valid = loadEnv({
      DATABASE_URL: 'postgresql://x',
      CORS_ORIGIN: 'https://app.example.com/path',
      APP_BASE_URL: 'https://web.example.com',
      LOG_LEVEL: 'warn',
    });
    expect(valid.logLevel).toBe('warn');
    expect([...(valid.allowedOrigins ?? [])].sort()).toEqual([
      'https://app.example.com',
      'https://web.example.com',
    ]);
  });

  it('rejects partial Google OAuth or partial SMTP configuration', () => {
    // Pre-filled GOOGLE_REDIRECT_URI alone (as in .env.example) is allowed.
    expect(
      loadEnv({
        DATABASE_URL: 'postgresql://x',
        GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
      }).googleClientId,
    ).toBeUndefined();

    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://x',
        GOOGLE_CLIENT_ID: 'client-id-only',
      }),
    ).toThrow(/Partial Google OAuth configuration/);

    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://x',
        SMTP_URL: 'smtp://localhost:1025',
      }),
    ).toThrow(/Partial SMTP configuration/);

    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://x',
        SMTP_URL: 'http://not-smtp:1025',
        SMTP_FROM: 'TerraGuessr <no-reply@example.test>',
      }),
    ).toThrow(/Invalid SMTP_URL protocol/);
  });
});
