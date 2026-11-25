// Real lobby service. Same method names/shapes as services/mock/lobbies.ts,
// backed by backend/src/modules/lobbies/routes.ts.

import type {
  Difficulty,
  GeographicIntelligence,
  GuessInput,
  Lobby,
  LobbyGuessResponse,
  LobbyMatchResponse,
  LobbySession,
} from '../../lib/contracts'
import { apiFetch } from './client'

export const lobbyHttp = {
  create(input: { difficulty: Difficulty; roundsTotal?: number; displayName?: string }): Promise<LobbySession> {
    return apiFetch<LobbySession>('/lobbies', { method: 'POST', body: input })
  },

  join(code: string, displayName?: string): Promise<LobbySession> {
    return apiFetch<LobbySession>(`/lobbies/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      body: displayName ? { displayName } : {},
    })
  },

  get(code: string, token?: string | null, signal?: AbortSignal): Promise<Lobby> {
    return apiFetch<Lobby>(`/lobbies/${encodeURIComponent(code)}`, {
      lobbyToken: token ?? null,
      signal,
    })
  },

  start(code: string, token: string): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/start`, {
      method: 'POST',
      lobbyToken: token,
    })
  },

  match(code: string, token: string, signal?: AbortSignal): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/match`, {
      lobbyToken: token,
      signal,
    })
  },

  selection(code: string, token: string, choice: GuessInput, roundId: string): Promise<void> {
    return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/selection`, {
      method: 'POST',
      body: { ...choice, roundId },
      lobbyToken: token,
    })
  },

  guess(
    code: string,
    roundNumber: number,
    token: string,
    guess: GuessInput,
    final = false,
  ): Promise<LobbyGuessResponse> {
    return apiFetch(`/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/guess`, {
      method: 'POST',
      body: { ...guess, final },
      lobbyToken: token,
    })
  },

  unlock(code: string, roundNumber: number, token: string): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/unlock`, {
      method: 'POST',
      lobbyToken: token,
    })
  },

  finish(
    code: string,
    roundNumber: number,
    token: string,
  ): Promise<LobbyGuessResponse> {
    return apiFetch(`/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/finish`, {
      method: 'POST',
      lobbyToken: token,
    })
  },

  continue(code: string, token: string): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/continue`, {
      method: 'POST',
      lobbyToken: token,
    })
  },

  intelligence(code: string, roundNumber: number, token: string, signal?: AbortSignal): Promise<GeographicIntelligence> {
    return apiFetch<GeographicIntelligence>(`/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/intelligence`, {
      lobbyToken: token,
      signal,
    })
  },

  leave(code: string, token: string): Promise<void> {
    return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/leave`, {
      method: 'POST',
      lobbyToken: token,
    })
  },
}
