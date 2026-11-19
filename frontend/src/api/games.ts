import { apiFetch } from './client'
import type { CreateGameInput, CreateGameResponse, GameSummary } from './types'

export function createGame(input: CreateGameInput): Promise<CreateGameResponse> {
  // No player token exists yet for a brand-new game (ADR-0011).
  return apiFetch<CreateGameResponse>('/games', { method: 'POST', body: input, playerToken: null })
}

export function getGame(gameId: string): Promise<GameSummary> {
  return apiFetch<GameSummary>(`/games/${encodeURIComponent(gameId)}`)
}
