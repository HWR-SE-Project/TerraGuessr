import { PageNavigation } from '../../components/ui/PageNavigation'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as gamesApi from '../../api/games'
import * as roundsApi from '../../api/rounds'
import * as resultsApi from '../../api/results'
import * as challengesApi from '../../api/challenges'
import { setPlayerToken } from '../../api/client'
import { mapApiError } from '../../api/errorMessages'
import type { CreateGameInput, GameResultsDTO, GuessResultDTO, LatLon, RoundDTO, SelectionMode } from '../../api/types'
import { GameSetupForm } from './GameSetupForm'
import { RoundView } from './RoundView'
import { ResultView } from './ResultView'
import { SummaryView } from './SummaryView'
import './PlayPage.css'

type Stage =
  | { kind: 'setup' }
  | { kind: 'round'; gameId: string; playerToken: string; roundsTotal: number; round: RoundDTO }
  | { kind: 'result'; gameId: string; playerToken: string; roundsTotal: number; round: RoundDTO; guess: LatLon; result: GuessResultDTO }
  | { kind: 'summary'; results: GameResultsDTO }

export function PlayPage() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>({ kind: 'setup' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [creatingChallenge, setCreatingChallenge] = useState(false)
  const [challengeError, setChallengeError] = useState<string | null>(null)

  async function handleStart(input: CreateGameInput & { selectionMode: SelectionMode }) {
    setBusy(true)
    setError(null)
    try {
      const game = await gamesApi.createGame(input)
      setPlayerToken(game.playerToken)
      const round = await roundsApi.startRound(game.gameId, input.selectionMode, game.playerToken)
      setStage({ kind: 'round', gameId: game.gameId, playerToken: game.playerToken, roundsTotal: game.roundsTotal, round })
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    if (stage.kind !== 'round') return
    setUnlocking(true)
    setUnlockError(null)
    try {
      const round = await roundsApi.unlockAdditionalData(stage.round.roundId)
      setStage({ ...stage, round })
    } catch (cause) {
      setUnlockError(mapApiError(cause))
    } finally {
      setUnlocking(false)
    }
  }

  async function handleSubmitGuess(guess: LatLon) {
    if (stage.kind !== 'round') return
    setBusy(true)
    setError(null)
    try {
      const result = await roundsApi.submitGuess(stage.round.roundId, guess)
      setStage({ kind: 'result', gameId: stage.gameId, playerToken: stage.playerToken, roundsTotal: stage.roundsTotal, round: stage.round, guess, result })
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleNext() {
    if (stage.kind !== 'result') return
    setBusy(true)
    setError(null)
    try {
      if (stage.round.roundNumber >= stage.roundsTotal) {
        const results = await resultsApi.getGameResults(stage.gameId)
        setStage({ kind: 'summary', results })
      } else {
        const round = await roundsApi.startRound(stage.gameId, stage.round.selectionMode, stage.playerToken)
        setStage({ kind: 'round', gameId: stage.gameId, playerToken: stage.playerToken, roundsTotal: stage.roundsTotal, round })
      }
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateChallenge() {
    if (stage.kind !== 'result') return
    setCreatingChallenge(true)
    setChallengeError(null)
    try {
      const challenge = await challengesApi.createChallenge(stage.round.roundId)
      navigate(`/challenge/${challenge.challengeId}`, { state: { justCreated: true, shareUrl: challenge.shareUrl } })
    } catch (cause) {
      setChallengeError(mapApiError(cause))
    } finally {
      setCreatingChallenge(false)
    }
  }

  return (
    <div className="tg-play-page">
      <PageNavigation active="none" />
      <div className="tg-play-shell">
        {stage.kind === 'setup' && <GameSetupForm onStart={handleStart} submitting={busy} error={error} />}
        {stage.kind === 'round' && (
          <RoundView
            round={stage.round}
            roundsTotal={stage.roundsTotal}
            onSubmit={handleSubmitGuess}
            submitting={busy}
            error={error}
            onUnlock={handleUnlock}
            unlocking={unlocking}
            unlockError={unlockError}
          />
        )}
        {stage.kind === 'result' && (
          <ResultView
            guess={stage.guess}
            result={stage.result}
            roundNumber={stage.round.roundNumber}
            roundsTotal={stage.roundsTotal}
            onNext={handleNext}
            advancing={busy}
            onCreateChallenge={handleCreateChallenge}
            creatingChallenge={creatingChallenge}
            challengeError={challengeError}
          />
        )}
        {stage.kind === 'summary' && <SummaryView results={stage.results} onPlayAgain={() => setStage({ kind: 'setup' })} />}
      </div>
    </div>
  )
}
