import { apiFetch } from './client'
import type { GameResultsDTO, ResultDTO } from './types'

export function getGameResults(gameId: string): Promise<GameResultsDTO> {
  return apiFetch<GameResultsDTO>(`/games/${encodeURIComponent(gameId)}/results`)
}

export function getResult(resultId: string): Promise<ResultDTO> {
  return apiFetch<ResultDTO>(`/results/${encodeURIComponent(resultId)}`)
}
