import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as gamesApi from '../../api/games'
import * as roundsApi from '../../api/rounds'
import * as challengesApi from '../../api/challenges'
import { setPlayerToken } from '../../api/client'
import { mapApiError } from '../../api/errorMessages'
import type { LatLon, RoundDTO } from '../../api/types'

export type DuelFlowStage =
  | { kind: 'idle' }
  | { kind: 'round'; round: RoundDTO }
  | { kind: 'creating' }
  | { kind: 'error'; message: string }

/** Starts a single-round "challenge" game, plays it, then creates a shareable async-duel link from the result — the real backend equivalent of a duel (no live matchmaking exists). */
export function useDuelFlow() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<DuelFlowStage>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    try {
      const game = await gamesApi.createGame({ mode: 'challenge', difficulty: 'medium', roundsTotal: 1 })
      setPlayerToken(game.playerToken)
      const round = await roundsApi.startRound(game.gameId, 'map', game.playerToken)
      setStage({ kind: 'round', round })
    } catch (cause) {
      setStage({ kind: 'error', message: mapApiError(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function submitGuess(guess: LatLon) {
    if (stage.kind !== 'round') return
    setBusy(true)
    try {
      const result = await roundsApi.submitGuess(stage.round.roundId, guess)
      setStage({ kind: 'creating' })
      const challenge = await challengesApi.createChallenge(stage.round.roundId)
      navigate(`/challenge/${challenge.challengeId}`, { state: { justCreated: true, shareUrl: challenge.shareUrl, score: result.score } })
    } catch (cause) {
      setStage({ kind: 'error', message: mapApiError(cause) })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStage({ kind: 'idle' })
  }

  return { stage, busy, start, submitGuess, reset }
}
