// Real lobby service. Same method names/shapes as services/mock/lobbies.ts,
// backed by backend/src/modules/lobbies/routes.ts.

import type {
  Difficulty,
  GeographicIntelligence,
  LatLon,
  Lobby,
  LobbyMatchResponse,
  LobbyMatchResult,
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

  get(code: string, token?: string | null): Promise<Lobby> {
    return apiFetch<Lobby>(`/lobbies/${encodeURIComponent(code)}`, {
      lobbyToken: token ?? null,
    })
  },

  start(code: string, token: string): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/start`, {
      method: 'POST',
      lobbyToken: token,
    })
  },

  match(code: string, token: string): Promise<LobbyMatchResponse> {
    return apiFetch<LobbyMatchResponse>(`/lobbies/${encodeURIComponent(code)}/match`, {
      lobbyToken: token,
    })
  },

  selection(code: string, token: string, point: LatLon): Promise<void> {
    return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/selection`, {
      method: 'POST',
      body: point,
      lobbyToken: token,
    })
  },

  guess(
    code: string,
    roundNumber: number,
    token: string,
    guess: LatLon,
    final = false,
  ): Promise<{ finalized: boolean; attemptsRemaining: number; result?: LobbyMatchResult }> {
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
  ): Promise<{ finalized: boolean; attemptsRemaining: number; result?: LobbyMatchResult }> {
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

  intelligence(code: string, roundNumber: number, token: string): Promise<GeographicIntelligence> {
    return apiFetch<GeographicIntelligence>(`/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/intelligence`, {
      lobbyToken: token,
    })
  },

  leave(code: string, token: string): Promise<void> {
    return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/leave`, {
      method: 'POST',
      lobbyToken: token,
    })
  },
}
