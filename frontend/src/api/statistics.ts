import { apiFetch } from './client'
import type { StatisticsMode, StatisticsResponse } from './types'

export function getStatistics(mode: StatisticsMode, limit = 20, offset = 0): Promise<StatisticsResponse> {
  return apiFetch<StatisticsResponse>(`/statistics?mode=${mode}&limit=${limit}&offset=${offset}`)
}
