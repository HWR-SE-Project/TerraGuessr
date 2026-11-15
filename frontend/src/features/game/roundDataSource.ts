import type { GuessResultDTO, LatLon, RoundDTO, SelectionMode } from '../../api/types';

/**
 * Injectable data source for the round screen (W-02). RoundScreen never
 * talks to the network itself — every real caller (App.tsx's solo loop,
 * ChallengeJoinFlow) wraps its own game-state-aware data source and passes
 * it in explicitly, so there is no standalone "apiRoundDataSource": that
 * would just re-POST /games/:gameId/rounds and /rounds/:id/guess a second
 * time, duplicating api/gameDataSource.ts's apiGameDataSource for no caller.
 * The stub below exists for RoundScreen's own isolated tests.
 */
export interface RoundDataSource {
  startRound(gameId: string, selectionMode?: SelectionMode): Promise<RoundDTO>;
  submitGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO>;
  submitAttempt?(roundId: string, guess: LatLon): Promise<RoundAttemptDTO>;
  finishRound?(roundId: string): Promise<GuessResultDTO>;
  unlockAdditionalData?(roundId: string): Promise<RoundDTO>;
}

export interface RoundAttemptDTO {
  attemptNumber: number;
  attemptsTotal: number;
  attemptsRemaining: number;
  distanceKm: number;
  score: number;
  result: GuessResultDTO | null;
}

const stubRound: RoundDTO = {
  roundId: 'stub-round-1',
  roundNumber: 1,
  attemptsTotal: 1,
  difficulty: 'easy',
  selectionMode: 'list',
  weather: {
    temperatureC: 12.4,
    precipitationMm: 0.8,
    humidityPct: 64,
    windSpeedKmh: 14.3,
  },
  additionalData: { mode: 'immediate', cost: null, availableAt: null, unlocked: true },
  candidates: [
    { id: 'c-berlin', name: 'Berlin', lat: 52.52, lon: 13.405, region: 'Europe' },
    { id: 'c-paris', name: 'Paris', lat: 48.8566, lon: 2.3522, region: 'Europe' },
    { id: 'c-madrid', name: 'Madrid', lat: 40.4168, lon: -3.7038, region: 'Europe' },
    { id: 'c-rome', name: 'Rome', lat: 41.9028, lon: 12.4964, region: 'Europe' },
    { id: 'c-london', name: 'London', lat: 51.5074, lon: -0.1278, region: 'Europe' },
  ],
};

const stubResult: GuessResultDTO = {
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
