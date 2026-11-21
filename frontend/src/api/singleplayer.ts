import { apiFetch } from './client'
import type { AdditionalDataAccessDTO, CandidateDTO, Difficulty, LatLon } from './types'

export interface GeographicIntelligence {
  fetchedAt: string
  cached: boolean
  weather: {
    modelTime: string | null
    temperatureC: number | null
    condition: string | null
    windSpeedKmh: number | null
    windDirectionDeg: number | null
    humidityPct: number | null
    pressureHpa: number | null
    precipitationMm: number | null
    precipitationIntervalMinutes: number | null
  } | null
  environment: {
    elevationM: number | null
    reliefM: number | null
    terrain: 'Low relief' | 'Rolling relief' | 'High relief' | null
    biome: null
    vegetation: null
  }
  climate: null
}
export interface StreetProviderConfig {
  available: boolean
  provider: 'google'
  serverKeyConfigured: boolean
}
export interface StreetRound {
  id: string
  number: number
  panoId: string
  /** Easy-difficulty list-mode options (R07); absent on medium/hard. */
  candidates?: CandidateDTO[]
  startedAt: string | null
  endsAt: string | null
  attemptsUsed: number
  attemptsTotal: number
  extraData: AdditionalDataAccessDTO
}
export interface StreetResult {
  roundId: string
  number: number
  guess: LatLon | null
  actual: LatLon
  distanceKm: number | null
  score: number
  extraDataPointsSpent?: number
}
export interface StreetGuessResponse {
  finalized: boolean
  attemptsRemaining: number
  result?: StreetResult
}
export interface StreetSession {
  id: string
  difficulty: Difficulty
  totalScore: number
  activeRound: StreetRound | null
  results: StreetResult[]
}
export interface StreetCredentials {
  id: string
  playerToken: string
}
const path = (id: string) => `/singleplayer/games/${encodeURIComponent(id)}`
export const singleplayerApi = {
  config: () =>
    apiFetch<StreetProviderConfig>('/singleplayer/config', {
      playerToken: null,
    }),
  create: (difficulty?: Difficulty) =>
    apiFetch<StreetCredentials>('/singleplayer/games', {
      method: 'POST',
      body: difficulty ? { difficulty } : undefined,
      playerToken: null,
    }),
  session: (credentials: StreetCredentials) =>
    apiFetch<StreetSession>(path(credentials.id), {
      playerToken: credentials.playerToken,
    }),
  next: (credentials: StreetCredentials) =>
    apiFetch<StreetRound>(`${path(credentials.id)}/rounds`, {
      method: 'POST',
      playerToken: credentials.playerToken,
    }),
  // Finalizes ("ends") the session server-side: a hard delete that makes it
  // permanently un-resumable while leaving already-scored rounds archived
  // (StreetResult, R18).
  end: (credentials: StreetCredentials) =>
    apiFetch<void>(path(credentials.id), {
      method: 'DELETE',
      playerToken: credentials.playerToken,
    }),
  retry: (credentials: StreetCredentials, roundId: string) =>
    apiFetch<StreetRound>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/retry`,
      { method: 'POST', playerToken: credentials.playerToken },
    ),
  intelligence: (
    credentials: StreetCredentials,
    roundId: string,
    signal?: AbortSignal,
  ) =>
    apiFetch<GeographicIntelligence>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/intelligence`,
      { playerToken: credentials.playerToken, signal },
    ),
  selection: (credentials: StreetCredentials, roundId: string, point: LatLon) =>
    apiFetch<void>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/selection`,
      { method: 'PUT', body: point, playerToken: credentials.playerToken },
    ),
  unlock: (credentials: StreetCredentials, roundId: string) =>
    apiFetch<StreetRound>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/unlock`,
      { method: 'POST', playerToken: credentials.playerToken },
    ),
  guess: (
    credentials: StreetCredentials,
    roundId: string,
    guess: LatLon,
    final = false,
  ) =>
    apiFetch<StreetGuessResponse>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/guess`,
      {
        method: 'POST',
        body: { ...guess, final },
        playerToken: credentials.playerToken,
      },
    ),
}
