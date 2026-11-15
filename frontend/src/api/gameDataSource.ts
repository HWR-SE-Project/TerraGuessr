// Solo game I/O glue (W-WIRE). Every call goes through api/client.ts so the
// X-Player-Token header and the ADR-0009 ApiError mapping stay in one place.
// A stub implementation keeps the UI playable when no backend is running.
import { ApiError, apiFetch } from './client';
import type {
  Difficulty,
  GameMode,
  GameResultsDTO,
  GuessResultDTO,
  LatLon,
  ResultDTO,
  RoundDTO,
  SelectionMode,
  WeatherDTO,
} from './types';

/** ADR-0008: solo games always have exactly this many rounds. */
export const ROUNDS_PER_GAME = 5;

export interface CreateGameInput {
  mode: GameMode;
  difficulty: Difficulty;
  roundsTotal?: number;
  geography?: 'world' | 'AFRICA' | 'EUROPE' | 'ASIA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA';
  candidateCount?: number;
  attemptsPerRound?: number;
}

/** POST /api/games 201 response — playerToken is issued exactly once (ADR-0011). */
export interface CreateGameResponse {
  gameId: string;
  playerToken: string;
  roundsTotal: number;
  attemptsPerRound: number;
}

/** Server I/O seam for the whole solo loop; tests inject a deterministic stub. */
export interface GameDataSource {
  createGame(input: CreateGameInput): Promise<CreateGameResponse>;
  /**
   * `playerToken` is optional and, when given, overrides whatever is in
   * localStorage for this one request (ADR-0011). The caller that just
   * created the game passes the fresh token explicitly here instead of
   * relying on it having already propagated to localStorage (P0-2) — see
   * App.tsx's `startGame`.
   */
  startRound(gameId: string, selectionMode?: SelectionMode, playerToken?: string): Promise<RoundDTO>;
  submitGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO>;
  getResults(gameId: string): Promise<GameResultsDTO>;
}

export const apiGameDataSource: GameDataSource = {
  async createGame(input) {
    // No auth yet: the player token does not exist before this call.
    return apiFetch<CreateGameResponse>('/games', {
      method: 'POST',
      body: input,
      playerToken: null,
    });
  },
  async startRound(gameId, selectionMode, playerToken) {
    return apiFetch<RoundDTO>('/games/' + encodeURIComponent(gameId) + '/rounds', {
      method: 'POST',
      body: selectionMode ? { selectionMode } : {},
      ...(playerToken !== undefined ? { playerToken } : {}),
    });
  },
  async submitGuess(roundId, guess) {
    return apiFetch<GuessResultDTO>('/rounds/' + encodeURIComponent(roundId) + '/guess', {
      method: 'POST',
      body: guess,
    });
  },
  async getResults(gameId) {
    return apiFetch<GameResultsDTO>('/games/' + encodeURIComponent(gameId) + '/results');
  },
};

// ---------------------------------------------------------------------------
// Stub data source: deterministic, in-memory, no network. Used by tests and as
// the dev fallback when the backend is unreachable.
// ---------------------------------------------------------------------------

const STUB_GAME_ID = 'stub-game';
const STUB_PLAYER_TOKEN = 'stub-player-token';
const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

const STUB_ACTUAL: LatLon = { lat: 48.8566, lon: 2.3522 };

const STUB_CANDIDATES = [
  { id: 'c-berlin', name: 'Berlin', lat: 52.52, lon: 13.405, region: 'EUROPE' },
  { id: 'c-lisbon', name: 'Lisbon', lat: 38.7223, lon: -9.1393, region: 'EUROPE' },
  { id: 'c-oslo', name: 'Oslo', lat: 59.9139, lon: 10.7522, region: 'EUROPE' },
  { id: 'c-paris', name: 'Paris', lat: 48.8566, lon: 2.3522, region: 'EUROPE' },
  { id: 'c-vienna', name: 'Vienna', lat: 48.2082, lon: 16.3738, region: 'EUROPE' },
] as const;

const STUB_WEATHERS: ReadonlyArray<WeatherDTO> = [
  { temperatureC: 12.4, precipitationMm: 0.8, humidityPct: 64, windSpeedKmh: 14.3 },
  { temperatureC: 21.6, precipitationMm: 0, humidityPct: 48, windSpeedKmh: 9.1 },
  { temperatureC: 7.2, precipitationMm: 3.4, humidityPct: 81, windSpeedKmh: 22.5 },
  { temperatureC: 27.9, precipitationMm: 0.2, humidityPct: 55, windSpeedKmh: 11.8 },
  { temperatureC: 17.1, precipitationMm: 1.1, humidityPct: 70, windSpeedKmh: 16.4 },
];

const DEFAULT_STUB_WEATHER: WeatherDTO = {
  temperatureC: 12.4,
  precipitationMm: 0.8,
  humidityPct: 64,
  windSpeedKmh: 14.3,
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Equirectangular approximation — plenty for deterministic demo scoring. */
function roughDistanceKm(a: LatLon, b: LatLon): number {
  const meanLat = toRadians((a.lat + b.lat) / 2);
  const x = toRadians(b.lon - a.lon) * Math.cos(meanLat);
  const y = toRadians(b.lat - a.lat);
  return Math.round(Math.sqrt(x * x + y * y) * 6371 * 10) / 10;
}

/**
 * Stub implementation: 5 rounds, then results. A new createGame() call resets
 * the counter so "Play again" works without a reload.
 */
export function createStubGameDataSource(): GameDataSource {
  let roundsStarted = 0;
  let roundsTotal = ROUNDS_PER_GAME;
  const results: ResultDTO[] = [];

  return {
    async createGame(input) {
      roundsStarted = 0;
      results.length = 0;
      roundsTotal = input.roundsTotal ?? ROUNDS_PER_GAME;
      return { gameId: STUB_GAME_ID, playerToken: STUB_PLAYER_TOKEN, roundsTotal, attemptsPerRound: input.attemptsPerRound ?? 1 };
    },

    async startRound(_gameId, selectionMode = 'list') {
      if (roundsStarted >= roundsTotal) {
        throw new ApiError('CONFLICT', 'All rounds of this game are complete.', 409);
      }
      roundsStarted += 1;
      const weather = STUB_WEATHERS[roundsStarted - 1] ?? DEFAULT_STUB_WEATHER;
      const round: RoundDTO = {
        roundId: `stub-round-${roundsStarted}`,
        roundNumber: roundsStarted,
        attemptsTotal: 1,
        difficulty: 'easy',
        selectionMode,
        weather,
      };
      if (selectionMode === 'list') {
        round.candidates = STUB_CANDIDATES.map((candidate) => ({ ...candidate }));
      }
      return round;
    },

    async submitGuess(roundId, guess) {
      const parsed = Number(roundId.replace('stub-round-', ''));
      const roundNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : roundsStarted;
      const distanceKm = roughDistanceKm(guess, STUB_ACTUAL);
      const score = Math.max(0, Math.round(5000 - distanceKm * 2));
      const result: ResultDTO = {
        resultId: `stub-result-${roundNumber}`,
        roundNumber,
        distanceKm,
        score,
        actual: STUB_ACTUAL,
        guess,
        createdAt: EPOCH_ISO,
      };
      const index = results.findIndex((entry) => entry.roundNumber === roundNumber);
      if (index >= 0) {
        results[index] = result;
      } else {
        results.push(result);
      }
      return {
        distanceKm: result.distanceKm,
        score: result.score,
        actual: result.actual,
        resultId: result.resultId,
      };
    },

    async getResults() {
      const sorted = [...results].sort((a, b) => a.roundNumber - b.roundNumber);
      return {
        results: sorted,
        totalScore: sorted.reduce((sum, entry) => sum + entry.score, 0),
      };
    },
  };
}
