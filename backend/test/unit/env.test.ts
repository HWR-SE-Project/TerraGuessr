import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it('defaults CORS to disabled (false), never a wildcard (Phase C)', () => {
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
});
