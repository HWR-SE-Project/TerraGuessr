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
export interface StreetProviderConfig {
  available: boolean
  provider: 'google'
  serverKeyConfigured: boolean
}
export interface StreetRound {
  id: string
  number: number
  panoId: string
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
  roundsTotal: number
  totalScore: number
  completed: boolean
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
  create: () =>
    apiFetch<StreetCredentials>('/singleplayer/games', {
      method: 'POST',
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
