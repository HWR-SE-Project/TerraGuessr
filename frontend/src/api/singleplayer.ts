import { apiFetch } from './client'
import type { LatLon } from './types'

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
    apiFetch<{ available: boolean }>('/singleplayer/config', {
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
  guess: (credentials: StreetCredentials, roundId: string, guess: LatLon) =>
    apiFetch<StreetResult>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/guess`,
      { method: 'POST', body: guess, playerToken: credentials.playerToken },
    ),
}
