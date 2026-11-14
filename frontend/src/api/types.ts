// Mirrors docs/agent-handoff/API-CONTRACTS.md (ADR-0010). The backend owns the
// frozen contract; this file is a hand-mirrored copy — never invent shapes here.

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameMode = 'solo' | 'challenge';

export type SelectionMode = 'map' | 'list';

/** R03/R06 — exactly these four metrics, always present. */
export interface WeatherDTO {
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
}

/** List mode only; never reveals which candidate is the actual location (R04). */
export interface CandidateDTO {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  region: string;
}

/** WGS84 decimal degrees: lat in [-90, 90], lon in [-180, 180]. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** ADR-0009 error envelope returned by every non-2xx response. */
export interface ErrorDTO {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** GET /api/games/{gameId} — 200 response. */
export interface GameSummary {
  gameId: string;
  mode: GameMode;
  difficulty: Difficulty;
  status: 'active' | 'completed';
  roundsPlayed: number;
  roundsTotal: number;
  currentRound: {
    roundId: string;
    roundNumber: number;
    status: 'active' | 'completed';
  } | null;
}

/** POST /api/games/{gameId}/rounds and GET /api/rounds/{roundId} — 200/201 response (R04/R06). */
export interface RoundDTO {
  roundId: string;
  roundNumber: number;
  difficulty: Difficulty;
  selectionMode: SelectionMode;
  weather: WeatherDTO;
  /** Present iff selectionMode === 'list'; never flags which candidate is actual (R04). */
  candidates?: CandidateDTO[];
}

/** POST /api/rounds/{roundId}/guess — 200 response (R11 reveal). */
export interface GuessResultDTO {
  distanceKm: number;
  score: number;
  actual: LatLon;
  resultId: string;
}

/** GET /api/games/{gameId}/results — one stored result (R11/R18). */
export interface ResultDTO {
  resultId: string;
  roundNumber: number;
  distanceKm: number;
  score: number;
  actual: LatLon;
  guess: LatLon;
  createdAt: string;
}

/** GET /api/games/{gameId}/results — 200 response. */
export interface GameResultsDTO {
  results: ResultDTO[];
  totalScore: number;
}
