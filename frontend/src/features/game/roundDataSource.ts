import { apiFetch } from '../../api/client';
import type { GuessResultDTO, LatLon, RoundDTO, SelectionMode } from '../../api/types';

/**
 * Injectable data source for the round screen (W-02). The real implementation
 * talks to B-06/B-07 once those endpoints exist; the stub lets the UI and tests
 * run without a backend.
 */
export interface RoundDataSource {
  startRound(gameId: string, selectionMode?: SelectionMode): Promise<RoundDTO>;
  submitGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO>;
}

export const apiRoundDataSource: RoundDataSource = {
  async startRound(gameId, selectionMode) {
    return apiFetch<RoundDTO>('/games/' + gameId + '/rounds', {
      method: 'POST',
      body: selectionMode ? { selectionMode } : {},
    });
  },
  async submitGuess(roundId, guess) {
    return apiFetch<GuessResultDTO>('/rounds/' + roundId + '/guess', {
      method: 'POST',
      body: guess,
    });
  },
};

export const stubRound: RoundDTO = {
  roundId: 'stub-round-1',
  roundNumber: 1,
  difficulty: 'easy',
  selectionMode: 'list',
  weather: {
    temperatureC: 12.4,
    precipitationMm: 0.8,
    humidityPct: 64,
    windSpeedKmh: 14.3,
  },
  candidates: [
    { id: 'c-berlin', name: 'Berlin', lat: 52.52, lon: 13.405, region: 'Europe' },
    { id: 'c-paris', name: 'Paris', lat: 48.8566, lon: 2.3522, region: 'Europe' },
    { id: 'c-madrid', name: 'Madrid', lat: 40.4168, lon: -3.7038, region: 'Europe' },
    { id: 'c-rome', name: 'Rome', lat: 41.9028, lon: 12.4964, region: 'Europe' },
    { id: 'c-london', name: 'London', lat: 51.5074, lon: -0.1278, region: 'Europe' },
  ],
};

export const stubResult: GuessResultDTO = {
  distanceKm: 877.2,
  score: 3225,
  actual: { lat: 48.8566, lon: 2.3522 },
  resultId: 'stub-result-1',
};

export function createStubRoundDataSource(): RoundDataSource {
  return {
    async startRound() {
      return stubRound;
    },
    async submitGuess() {
      return stubResult;
    },
  };
}
