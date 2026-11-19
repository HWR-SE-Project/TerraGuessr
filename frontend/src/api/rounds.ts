import { apiFetch } from './client'
import type { GuessResultDTO, LatLon, RoundDTO, SelectionMode } from './types'

export function startRound(gameId: string, selectionMode?: SelectionMode, playerToken?: string): Promise<RoundDTO> {
  return apiFetch<RoundDTO>(`/games/${encodeURIComponent(gameId)}/rounds`, {
    method: 'POST',
    body: selectionMode ? { selectionMode } : {},
    ...(playerToken !== undefined ? { playerToken } : {}),
  })
}

export function getRound(roundId: string): Promise<RoundDTO> {
  return apiFetch<RoundDTO>(`/rounds/${encodeURIComponent(roundId)}`)
}

export function submitGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO> {
  return apiFetch<GuessResultDTO>(`/rounds/${encodeURIComponent(roundId)}/guess`, { method: 'POST', body: guess })
}

export function unlockAdditionalData(roundId: string): Promise<RoundDTO> {
  return apiFetch<RoundDTO>(`/rounds/${encodeURIComponent(roundId)}/intelligence/unlock`, { method: 'POST' })
}
