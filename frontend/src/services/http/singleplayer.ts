// Real singleplayer service. Same method names/shapes as
// services/mock/singleplayer.ts, backed by backend/src/modules/singleplayer/routes.ts.

import type {
  Difficulty,
  GeographicIntelligence,
  GuessInput,
  StreetCredentials,
  StreetGuessResponse,
  StreetRound,
  StreetSession,
} from '../../lib/contracts'
import { apiFetch } from './client'

const path = (id: string) => `/singleplayer/games/${encodeURIComponent(id)}`

export const singleplayerHttp = {
  config(): Promise<{ available: boolean; provider: 'diorama'; serverKeyConfigured: boolean }> {
    return apiFetch('/singleplayer/config')
  },

  create(difficulty: Difficulty = 'medium', roundsTotal?: number | null): Promise<StreetCredentials> {
    return apiFetch<StreetCredentials>('/singleplayer/games', {
      method: 'POST',
      body: roundsTotal === undefined ? { difficulty } : { difficulty, roundsTotal },
    })
  },

  session(credentials: StreetCredentials): Promise<StreetSession> {
    return apiFetch<StreetSession>(path(credentials.id), {
      playerToken: credentials.playerToken,
    })
  },

  next(credentials: StreetCredentials): Promise<StreetRound> {
    return apiFetch<StreetRound>(`${path(credentials.id)}/rounds`, {
      method: 'POST',
      playerToken: credentials.playerToken,
    })
  },

  intelligence(
    credentials: StreetCredentials,
    roundId: string,
    signal?: AbortSignal,
  ): Promise<GeographicIntelligence> {
    return apiFetch<GeographicIntelligence>(
      `${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/intelligence`,
      { playerToken: credentials.playerToken, signal },
    )
  },

  selection(credentials: StreetCredentials, roundId: string, choice: GuessInput): Promise<void> {
    return apiFetch<void>(`${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/selection`, {
      method: 'PUT',
      body: choice,
      playerToken: credentials.playerToken,
    })
  },

  unlock(credentials: StreetCredentials, roundId: string): Promise<StreetRound> {
    return apiFetch<StreetRound>(`${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/unlock`, {
      method: 'POST',
      playerToken: credentials.playerToken,
    })
  },

  retry(credentials: StreetCredentials, roundId: string): Promise<StreetRound> {
    return apiFetch<StreetRound>(`${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/retry`, {
      method: 'POST',
      playerToken: credentials.playerToken,
    })
  },

  guess(
    credentials: StreetCredentials,
    roundId: string,
    guess: GuessInput,
    final = false,
  ): Promise<StreetGuessResponse> {
    return apiFetch<StreetGuessResponse>(`${path(credentials.id)}/rounds/${encodeURIComponent(roundId)}/guess`, {
      method: 'POST',
      body: { ...guess, final },
      playerToken: credentials.playerToken,
    })
  },

  end(credentials: StreetCredentials): Promise<void> {
    return apiFetch<void>(path(credentials.id), {
      method: 'DELETE',
      playerToken: credentials.playerToken,
    })
  },
}
