import type { LobbyBounds } from './contracts'

// Mirrors backend/src/config/constants.ts so lobby copy stays consistent
// before /api/game-rules finishes loading or on older servers.
export const MIN_LOBBY_PLAYERS = 2
export const MAX_LOBBY_PLAYERS = 16

export const DEFAULT_LOBBY_BOUNDS: LobbyBounds = {
  minPlayers: MIN_LOBBY_PLAYERS,
  maxPlayers: MAX_LOBBY_PLAYERS,
}

export function resolveLobbyBounds(bounds?: LobbyBounds | null): LobbyBounds {
  if (!bounds) return DEFAULT_LOBBY_BOUNDS
  return bounds
}
