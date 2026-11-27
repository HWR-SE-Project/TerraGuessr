import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';

import type { Env } from '../../src/config/env.js';
import { AUTH_EMAIL_RATE_LIMIT, RATE_LIMITS } from '../../src/config/constants.js';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import {
  EmailRateLimiter,
  formatEmailRateLimitMessage,
} from '../../src/modules/auth/emailRateLimit.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';

function emailTestEnv(): Env {
  return {
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    nodeEnv: 'test',
    port: 3000,
    corsOrigin: false,
    metNoBaseUrl: 'https://api.met.no',
    logLevel: 'silent',
    smtpUrl: 'smtp://localhost:1025',
    smtpFrom: 'noreply@terraguessr.test',
    appBaseUrl: 'http://localhost:8080',
    sessionCookieSecure: false,
    trustProxy: false,
  };
}

describe('EmailRateLimiter', () => {
  it('enforces per-email cooldown and sliding hourly window independently per normalized address', () => {
    let clock = 1_000_000;
    const limiter = new EmailRateLimiter({
      maxPerWindow: 3,
      windowMs: 60 * 60 * 1000,
      cooldownMs: 30 * 1000,
      now: () => clock,
    });

    // 1st send succeeds; immediate repeat (even with different case/whitespace) hits 30s cooldown.
    expect(limiter.consume('password-reset', 'Alice@Example.test')).toEqual({ allowed: true });
    const cooled = limiter.consume('password-reset', '  alice@example.test  ');
    expect(cooled).toEqual({ allowed: false, reason: 'cooldown', retryAfterSeconds: 30 });
    if (!cooled.allowed) {
      expect(formatEmailRateLimitMessage(cooled)).toBe(
        'Please wait 30 seconds before requesting another email.',
      );
    }

    // Different address or different namespace is unaffected.
    expect(limiter.consume('password-reset', 'bob@example.test')).toEqual({ allowed: true });
    expect(limiter.consume('verification-resend', 'alice@example.test')).toEqual({ allowed: true });

    // Advance past cooldown for 2nd and 3rd sends.
    clock += 30_000;
    expect(limiter.consume('password-reset', 'alice@example.test')).toEqual({ allowed: true });
    clock += 30_000;
    expect(limiter.consume('password-reset', 'alice@example.test')).toEqual({ allowed: true });

    // Advance past cooldown again -> now hits the 3/hour window cap.
    clock += 30_000;
    const capped = limiter.consume('password-reset', 'alice@example.test');
    expect(capped.allowed).toBe(false);
    if (!capped.allowed) {
      expect(capped.reason).toBe('window');
      // Oldest timestamp was at 1_000_000; current is 1_090_000 -> 3_510s remaining (59 min).
      expect(capped.retryAfterSeconds).toBe(3510);
      expect(formatEmailRateLimitMessage(capped)).toBe(
        'Too many email requests for this address. Please try again in 59 minutes.',
      );
    }

    // Once the oldest entry slides outside the 1-hour window, a new send is allowed.
    clock = 1_000_000 + 60 * 60 * 1000 + 1;
    expect(limiter.consume('password-reset', 'alice@example.test')).toEqual({ allowed: true });
  });

  it('bounds tracked keys under spray attacks', () => {
    let clock = 1_000_000;
    const limiter = new EmailRateLimiter({
      maxPerWindow: 5,
      windowMs: 60_000,
      cooldownMs: 10_000,
      maxKeys: 3,
      now: () => clock,
    });

    expect(limiter.consume('password-reset', 'u1@example.test')).toEqual({ allowed: true });
    clock += 1;
    expect(limiter.consume('password-reset', 'u2@example.test')).toEqual({ allowed: true });
    clock += 1;
    expect(limiter.consume('password-reset', 'u3@example.test')).toEqual({ allowed: true });
    clock += 1;
    // Evicts oldest key (u1) cleanly without throwing.
    expect(limiter.consume('password-reset', 'u4@example.test')).toEqual({ allowed: true });
  });
});

describe('layered auth email rate limiting (routes)', () => {
  it('enforces per-email cooldown and hourly cap with Retry-After while keeping a looser IP ceiling', async () => {
    let clock = 5_000_000;
    const limiter = new EmailRateLimiter({
      ...AUTH_EMAIL_RATE_LIMIT,
      now: () => clock,
    });
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = { user: { findUnique } } as unknown as PrismaClient;
    const mailer = vi.fn().mockResolvedValue(undefined);

    const app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    await app.register(rateLimit, {
      global: true,
      max: RATE_LIMITS.globalDefault.max,
      timeWindow: RATE_LIMITS.globalDefault.timeWindow,
    });
    registerAuthRoutes(app, {
      config: emailTestEnv(),
      db,
      mailer,
      emailRateLimiter: limiter,
    });

    try {
      // 1st request succeeds even for non-existent email (non-enumerating 202).
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        payload: { email: 'one@example.test' },
      });
      expect(first.statusCode).toBe(202);
      expect(Number(first.headers['x-ratelimit-limit'])).toBe(RATE_LIMITS.authEmailIp.max);

      // Immediate retry for the SAME email hits the per-email 30s cooldown BEFORE DB lookup.
      const dbCallsBefore = findUnique.mock.calls.length;
      const cooldownRes = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        payload: { email: 'ONE@example.test' },
      });
      expect(cooldownRes.statusCode).toBe(429);
      expect(cooldownRes.headers['retry-after']).toBe('30');
      expect(cooldownRes.json()).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Please wait 30 seconds before requesting another email.',
        },
      });
      expect(findUnique.mock.calls.length).toBe(dbCallsBefore);

      // A DIFFERENT email on the same IP still succeeds immediately (not locked out by one@example.test).
      const otherEmail = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        payload: { email: 'two@example.test' },
      });
      expect(otherEmail.statusCode).toBe(202);

      // Consume the remaining 4 hourly sends for one@example.test, spaced past cooldown.
      for (let i = 0; i < 4; i += 1) {
        clock += 31_000;
        const ok = await app.inject({
          method: 'POST',
          url: '/api/auth/password-reset/request',
          payload: { email: 'one@example.test' },
        });
        expect(ok.statusCode).toBe(202);
      }

      // 6th send for one@example.test within the hour hits the per-email hourly cap.
      clock += 31_000;
      const hourlyCapped = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset/request',
        payload: { email: 'one@example.test' },
      });
      expect(hourlyCapped.statusCode).toBe(429);
      expect(Number(hourlyCapped.headers['retry-after'])).toBeGreaterThan(3000);
      expect(hourlyCapped.json().error).toMatchObject({
        code: 'RATE_LIMITED',
        message: expect.stringMatching(/Too many email requests for this address\. Please try again in \d+ minutes?\./),
      });

      // Verification resend uses its own namespace and enforces the same per-email limiter.
      const verifyFirst = await app.inject({
        method: 'POST',
        url: '/api/auth/verification/resend',
        payload: { email: 'one@example.test' },
      });
      expect(verifyFirst.statusCode).toBe(202);

      const verifyCooldown = await app.inject({
        method: 'POST',
        url: '/api/auth/verification/resend',
        payload: { email: 'one@example.test' },
      });
      expect(verifyCooldown.statusCode).toBe(429);
      expect(verifyCooldown.headers['retry-after']).toBe('30');
    } finally {
      await app.close();
    }
  });
});
