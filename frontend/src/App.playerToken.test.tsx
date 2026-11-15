// Regression test for P0-2: the frontend used to call startRound immediately
// after game creation, relying on a useEffect to have already written the
// fresh player token to localStorage. That effect only commits after this
// synchronous flow continues, so a brand-new player's first round request
// went out with no (or a stale) X-Player-Token header and the backend's
// requirePlayerToken hook rejected it with 404. This test exercises the real
// apiGameDataSource (not the stub) against a mocked fetch to prove the fresh
// token is sent on that very first request, before localStorage has it.
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PLAYER_TOKEN_STORAGE_KEY } from './api/client';
import { apiGameDataSource } from './api/gameDataSource';

const GAME_ID = 'game-1';
const PLAYER_TOKEN = 'fresh-token-abc';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('P0-2 regression: player-token propagation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the freshly issued player token on the very first round request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/games') && init?.method === 'POST') {
        return jsonResponse({ gameId: GAME_ID, playerToken: PLAYER_TOKEN }, 201);
      }
      if (url.endsWith(`/games/${GAME_ID}/rounds`) && init?.method === 'POST') {
        // The regression itself: assert the header right where the race used
        // to lose it, rather than only checking localStorage afterwards.
        const header = new Headers(init.headers).get('X-Player-Token');
        expect(header).toBe(PLAYER_TOKEN);
        return jsonResponse({
          roundId: 'round-1',
          roundNumber: 1,
          difficulty: 'easy',
          selectionMode: 'list',
          weather: { temperatureC: 10, precipitationMm: 0, humidityPct: 50, windSpeedKmh: 5 },
          candidates: [{ id: 'c1', name: 'Candidate', lat: 1, lon: 1, region: 'EUROPE' }],
        });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App dataSource={apiGameDataSource} />);

    // Clean browser session: no token anywhere before the player acts.
    expect(localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByTestId('start-game'));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Round 1' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY)).toBe(PLAYER_TOKEN);
  });
});
