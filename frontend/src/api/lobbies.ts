import { apiFetch } from './client'
import type { Difficulty, LobbyDTO, LobbySessionDTO } from './types'

const LOBBY_TOKEN_PREFIX = 'terraguessr.lobby.'

function storageKey(code: string): string {
  return `${LOBBY_TOKEN_PREFIX}${code.toUpperCase()}`
}

/** Lobby tokens are scoped to the code so they never clobber the game token. */
export function getLobbyToken(code: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(storageKey(code))
}

export function setLobbyToken(code: string, token: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey(code), token)
}

export function clearLobbyToken(code: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(storageKey(code))
}

export function createLobby(input: {
  difficulty: Difficulty
  displayName?: string
}): Promise<LobbySessionDTO> {
  return apiFetch<LobbySessionDTO>('/lobbies', {
    method: 'POST',
    body: input,
    lobbyToken: null,
  })
}

export function joinLobby(
  code: string,
  displayName?: string,
): Promise<LobbySessionDTO> {
  return apiFetch<LobbySessionDTO>(
    `/lobbies/${encodeURIComponent(code)}/join`,
    {
      method: 'POST',
      body: displayName ? { displayName } : {},
      lobbyToken: null,
    },
  )
}

export function getLobby(code: string, token?: string | null): Promise<LobbyDTO> {
  return apiFetch<LobbyDTO>(`/lobbies/${encodeURIComponent(code)}`, {
    lobbyToken: token ?? null,
  })
}

export function leaveLobby(code: string, token: string): Promise<void> {
  return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/leave`, {
    method: 'POST',
    lobbyToken: token,
  })
}

export function deleteLobby(code: string, token: string): Promise<void> {
  return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    lobbyToken: token,
  })
}
