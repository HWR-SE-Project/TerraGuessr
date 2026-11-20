import { apiFetch } from './client'
import type { LatLon } from './types'

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
export type Difficulty = 'easy' | 'medium' | 'hard'
export interface StreetProviderConfig {
  available: boolean
  provider: 'google'
  serverKeyConfigured: boolean
}
export interface StreetCandidate {
  id: string
  name: string
  region: string
  lat: number
  lon: number
}
export interface StreetRound {
  id: string
  number: number
  panoId: string
  /** Easy-difficulty list-mode options (R07); absent on medium/hard. */
  candidates?: StreetCandidate[]
}
export interface StreetResult {
  roundId: string
  number: number
  guess: LatLon
  actual: LatLon
  distanceKm: number
  score: number
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
  guess: (credentials: StreetCredentials, roundId: string, guess: LatLon) =>
    apiFetch<StreetResult>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/guess`,
      { method: 'POST', body: guess, playerToken: credentials.playerToken },
    ),
}
