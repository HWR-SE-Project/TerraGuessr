import { test, expect } from '@playwright/test';
import { findActualKeys } from './support/game';

/**
 * R04 network assertion: the round-start response must never carry the actual
 * location. This inspects the raw HTTP JSON of POST /api/games/:id/rounds
 * (and its idempotent GET /api/rounds/:id re-fetch) directly, so it needs only
 * the backend up — no UI wiring required.
 */
test.describe('R04 network assertion', () => {
  test('round-start response never carries actual coordinates', async ({ page }) => {
    const create = await page.request.post('/api/games', {
      data: { mode: 'solo', difficulty: 'medium' },
    });
    expect(create.status()).toBe(201);
    const { gameId, playerToken } = (await create.json()) as {
      gameId: string;
      playerToken: string;
    };

    const start = await page.request.post('/api/games/' + gameId + '/rounds', {
      headers: { 'X-Player-Token': playerToken },
      data: {},
    });
    expect(start.status()).toBe(201);
    const body = (await start.json()) as Record<string, unknown>;
    expect(findActualKeys(body)).toEqual([]);

    // Idempotent re-fetch must carry the same R04 guarantee.
    const roundId = body.roundId as string;
    const refetch = await page.request.get('/api/rounds/' + roundId, {
      headers: { 'X-Player-Token': playerToken },
    });
    expect(refetch.status()).toBe(200);
    expect(findActualKeys(await refetch.json())).toEqual([]);
  });
});
