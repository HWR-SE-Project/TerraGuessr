import { apiFetch } from './client'
import type {
  Difficulty,
  LobbyDTO,
  LobbyGuessResponseDTO,
  LobbyMatchResponseDTO,
  LobbySessionDTO,
  LatLon,
} from './types'
import type { GeographicIntelligence } from './singleplayer'

const LOBBY_TOKEN_PREFIX = 'terraguessr.lobby.'
const CURRENT_LOBBY_KEY = 'terraguessr.lobby.current'

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

export function getCurrentLobbyCode(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(CURRENT_LOBBY_KEY)
}

export function setCurrentLobbyCode(code: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CURRENT_LOBBY_KEY, code.toUpperCase())
}

export function clearCurrentLobbyCode(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(CURRENT_LOBBY_KEY)
}

export function createLobby(input: {
  difficulty: Difficulty
  roundsTotal?: number
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

export function startLobbyMatch(
  code: string,
  token: string,
): Promise<LobbyMatchResponseDTO> {
  return apiFetch<LobbyMatchResponseDTO>(
    `/lobbies/${encodeURIComponent(code)}/start`,
    { method: 'POST', lobbyToken: token },
  )
}

export function getLobbyMatch(
  code: string,
  token: string,
): Promise<LobbyMatchResponseDTO> {
  return apiFetch<LobbyMatchResponseDTO>(
    `/lobbies/${encodeURIComponent(code)}/match`,
    { lobbyToken: token },
  )
}

export function continueLobbyMatch(
  code: string,
  token: string,
): Promise<LobbyMatchResponseDTO> {
  return apiFetch<LobbyMatchResponseDTO>(
    `/lobbies/${encodeURIComponent(code)}/continue`,
    { method: 'POST', lobbyToken: token },
  )
}

export function saveLobbySelection(
  code: string,
  token: string,
  selection: LatLon,
): Promise<void> {
  return apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/selection`, {
    method: 'POST',
    body: selection,
    lobbyToken: token,
  })
}

export function submitLobbyGuess(
  code: string,
  roundNumber: number,
  token: string,
  guess: LatLon,
  final = false,
): Promise<LobbyGuessResponseDTO> {
  return apiFetch<LobbyGuessResponseDTO>(
    `/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/guess`,
    { method: 'POST', body: { ...guess, final }, lobbyToken: token },
  )
}

export function finishLobbyRound(
  code: string,
  roundNumber: number,
  token: string,
): Promise<LobbyGuessResponseDTO> {
  return apiFetch<LobbyGuessResponseDTO>(
    `/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/finish`,
    { method: 'POST', lobbyToken: token },
  )
}

export function getLobbyIntelligence(
  code: string,
  roundNumber: number,
  token: string,
  signal?: AbortSignal,
): Promise<GeographicIntelligence> {
  return apiFetch<GeographicIntelligence>(
    `/lobbies/${encodeURIComponent(code)}/rounds/${roundNumber}/intelligence`,
    { lobbyToken: token, signal },
  )
}

export function leaveLobbyBeacon(code: string, token: string): void {
  void apiFetch<void>(`/lobbies/${encodeURIComponent(code)}/leave`, {
    method: 'POST',
    lobbyToken: token,
    keepalive: true,
  }).catch(() => {})
}
