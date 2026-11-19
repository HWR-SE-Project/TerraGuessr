import { apiFetch } from './client'
import type { DailyGuessResponse, DailyLeaderboardResponse, DailyTodayResponse, LatLon } from './types'

export function getDailyToday(): Promise<DailyTodayResponse> {
  return apiFetch<DailyTodayResponse>('/daily/today')
}

export function submitDailyGuess(guess: LatLon): Promise<DailyGuessResponse> {
  return apiFetch<DailyGuessResponse>('/daily/today/guess', { method: 'POST', body: guess })
}

export function getDailyLeaderboard(date: string, limit = 20, offset = 0): Promise<DailyLeaderboardResponse> {
  return apiFetch<DailyLeaderboardResponse>(`/daily/${encodeURIComponent(date)}/leaderboard?limit=${limit}&offset=${offset}`)
}
