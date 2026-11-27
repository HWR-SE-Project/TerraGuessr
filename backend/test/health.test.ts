import { beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { ReadinessDb } from '../src/app.js';
import { gameRulesFor } from '../src/domain/gameRules.js';
import { scoreForDistance } from '../src/domain/scoring.js';

describe('GET /api/health', () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/terraguessr_test';
    process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
  });

  it('returns { status: "ok", time } with a 200 status', async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = response.json() as {
        status: string;
        time: string;
        commit: string | null;
      };
      expect(body.status).toBe('ok');
      expect(typeof body.time).toBe('string');
      expect(Number.isNaN(Date.parse(body.time))).toBe(false);
      expect(body.commit).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('exposes RENDER_GIT_COMMIT on /api/health for backend-first deploy verification', async () => {
    const previous = process.env.RENDER_GIT_COMMIT;
    try {
      process.env.RENDER_GIT_COMMIT = '0123456789abcdef0123456789abcdef01234567';
      const app = await buildApp();
      try {
        const response = await app.inject({
          method: 'GET',
          url: '/api/health',
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.json()).toMatchObject({
          status: 'ok',
          commit: '0123456789abcdef0123456789abcdef01234567',
        });
      } finally {
        await app.close();
      }
    } finally {
      if (previous === undefined) delete process.env.RENDER_GIT_COMMIT;
      else process.env.RENDER_GIT_COMMIT = previous;
    }
  });

  it('omits CORS headers by default and permits only an explicitly configured origin', async () => {
    const previous = process.env.CORS_ORIGIN;
    try {
      delete process.env.CORS_ORIGIN;
      const closedApp = await buildApp();
      try {
        const response = await closedApp.inject({
          method: 'GET', url: '/api/health', headers: { origin: 'https://other.example' },
        });
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
      } finally {
        await closedApp.close();
      }

      process.env.CORS_ORIGIN = 'https://allowed.example';
      const configuredApp = await buildApp();
      try {
        const response = await configuredApp.inject({
          method: 'GET', url: '/api/health', headers: { origin: 'https://allowed.example' },
        });
        expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example');
        expect(response.headers['access-control-allow-credentials']).toBe('true');
      } finally {
        await configuredApp.close();
      }
    } finally {
      if (previous === undefined) delete process.env.CORS_ORIGIN;
      else process.env.CORS_ORIGIN = previous;
    }
  });

  it('publishes the same difficulty rules and scores the game uses', async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ url: '/api/game-rules' });
      expect(response.statusCode).toBe(200);
      const catalog = response.json();
      for (const difficulty of ['easy', 'medium', 'hard']) {
        expect(catalog.difficulties[difficulty]).toEqual(gameRulesFor(difficulty));
      }
      const { exampleScores, exampleDistanceStepKm } = catalog.scoring;
      expect(exampleScores[0]).toBe(scoreForDistance(0));
      expect(exampleScores[2000 / exampleDistanceStepKm]).toBe(scoreForDistance(2000));
      expect(exampleScores.at(-1)).toBe(0);
      expect(catalog.scoring.londonParisKm).toBeCloseTo(343.56, 1);
      expect(catalog.rounds).toEqual({ min: 3, max: 10, default: 5 });
      expect(catalog.lobby).toEqual({ minPlayers: 2, maxPlayers: 16 });
    } finally {
      await app.close();
    }
  });
});

describe('GET /api/ready', () => {
  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/terraguessr_test';
    process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
  });

  it('returns 200 { status: "ok", db: "ok", time } when SELECT 1 succeeds', async () => {
    const readyDb: ReadinessDb = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const app = await buildApp({ readyDb });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(response.statusCode).toBe(200);
      expect(readyDb.$queryRaw).toHaveBeenCalledTimes(1);
      const body = response.json() as { status: string; db: string; time: string };
      expect(body.status).toBe('ok');
      expect(body.db).toBe('ok');
      expect(Number.isNaN(Date.parse(body.time))).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('returns 503 when the database probe fails', async () => {
    const readyDb: ReadinessDb = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const app = await buildApp({ readyDb });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(response.statusCode).toBe(503);
      const body = response.json() as { status: string; db: string; time: string };
      expect(body.status).toBe('unavailable');
      expect(body.db).toBe('unavailable');
    } finally {
      await app.close();
    }
  });

  it('returns 503 when the database probe times out', async () => {
    const readyDb: ReadinessDb = {
      $queryRaw: vi.fn().mockImplementation(() => new Promise(() => {})),
    };
    const app = await buildApp({ readyDb, readyTimeoutMs: 25 });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ status: 'unavailable', db: 'unavailable' });
    } finally {
      await app.close();
    }
  });
});
