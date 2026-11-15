import { beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

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

      const body = response.json() as { status: string; time: string };
      expect(body.status).toBe('ok');
      expect(typeof body.time).toBe('string');
      expect(Number.isNaN(Date.parse(body.time))).toBe(false);
    } finally {
      await app.close();
    }
  });
});
