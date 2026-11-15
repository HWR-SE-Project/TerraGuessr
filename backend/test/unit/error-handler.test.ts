import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';

class StatusError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function buildApp() {
  const app = Fastify();
  registerErrorHandler(app);
  return app;
}

describe('error handler envelope (ADR-0009)', () => {
  const cases: Array<[number, string]> = [
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ];

  for (const [status, code] of cases) {
    it(`maps a ${status} error to code "${code}" with the real message`, async () => {
      const app = buildApp();
      app.get('/boom', async () => {
        throw new StatusError('something specific happened', status);
      });

      try {
        const res = await app.inject({ method: 'GET', url: '/boom' });
        expect(res.statusCode).toBe(status);
        expect(res.json()).toMatchObject({ error: { code } });
      } finally {
        await app.close();
      }
    });
  }

  it('hides the real message for 5xx (never leaks internals)', async () => {
    const app = buildApp();
    app.get('/boom', async () => {
      throw new Error('leaked stack trace detail');
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/boom' });
      expect(res.statusCode).toBe(500);
      const body = res.json() as { error: { code: string; message: string } };
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.message).not.toContain('leaked stack trace detail');
    } finally {
      await app.close();
    }
  });
});
