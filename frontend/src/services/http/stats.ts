import type {
  Difficulty,
  GameMode,
  MatchHistoryResponse,
  PlayerStatistics,
  StatsDifficultyFilter,
  StatsModeFilter,
  StatsPeriod,
} from '../../lib/contracts'
import { apiFetch } from './client'

export interface StatsOverviewParams {
  period?: StatsPeriod
  mode?: StatsModeFilter
  difficulty?: StatsDifficultyFilter
}

export interface MatchHistoryParams {
  limit?: number
  offset?: number
  mode?: GameMode
  difficulty?: Difficulty
}

export const statsHttp = {
  getOverview(params: StatsOverviewParams = {}): Promise<PlayerStatistics> {
    const query = new URLSearchParams()
    if (params.period) query.set('period', params.period)
    if (params.mode) query.set('mode', params.mode)
    if (params.difficulty) query.set('difficulty', params.difficulty)
    const qs = query.toString()
    return apiFetch<PlayerStatistics>(`/me/statistics${qs ? `?${qs}` : ''}`)
  },

  getMatches(params: MatchHistoryParams = {}): Promise<MatchHistoryResponse> {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.mode) query.set('mode', params.mode)
    if (params.difficulty) query.set('difficulty', params.difficulty)
    const qs = query.toString()
    return apiFetch<MatchHistoryResponse>(`/me/results${qs ? `?${qs}` : ''}`)
  },
}
