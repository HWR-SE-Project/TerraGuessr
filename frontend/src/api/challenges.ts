import { apiFetch } from './client'
import { submitGuess } from './rounds'
import type { ChallengeDTO, ChallengeEntryDTO, GuessResultDTO, JoinedChallengeRound, LatLon, LeaderboardDTO, SelectionMode } from './types'

export function createChallenge(roundId: string): Promise<ChallengeDTO> {
  return apiFetch<ChallengeDTO>('/challenges', { method: 'POST', body: { roundId } })
}

export function joinChallenge(challengeId: string, selectionMode?: SelectionMode): Promise<JoinedChallengeRound> {
  // No token exists yet for this participant (ADR-0011), same as createGame.
  return apiFetch<JoinedChallengeRound>(`/challenges/${encodeURIComponent(challengeId)}/join`, {
    method: 'POST',
    body: selectionMode ? { selectionMode } : {},
    playerToken: null,
  })
}

/** Same endpoint solo games use — mode-agnostic. */
export function submitChallengeGuess(roundId: string, guess: LatLon): Promise<GuessResultDTO> {
  return submitGuess(roundId, guess)
}

export function submitChallengeEntry(challengeId: string, resultId: string, displayName?: string): Promise<ChallengeEntryDTO> {
  return apiFetch<ChallengeEntryDTO>(`/challenges/${encodeURIComponent(challengeId)}/entries`, {
    method: 'POST',
    body: { resultId, displayName },
  })
}

export function getChallengeLeaderboard(challengeId: string): Promise<LeaderboardDTO> {
  return apiFetch<LeaderboardDTO>(`/challenges/${encodeURIComponent(challengeId)}/leaderboard`)
}
