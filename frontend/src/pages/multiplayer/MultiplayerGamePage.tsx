import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { GuessInput, LobbyLeaderboardEntry, LobbyMatchResponse, LobbyMatchResult, LobbyParticipantGuess } from '../../lib/contracts'
import { api, ApiError } from '../../services'
import { useLobbyPolling, useLobbyRoute } from './useLobbyRoute'
import { RoundResultDetails } from '../../components/game/RoundResultDetails'
import { RoundStage } from '../../components/game/RoundStage'
import { PlayerBadge } from '../../components/game/PlayerBadge'
import { Timer } from '../../components/game/Timer'
import { Button, Spinner } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { formatCoordinates, formatScore } from '../../lib/format'

export function MultiplayerGamePage() {
  const { code, session, leaving, leave, openWaitingRoom } = useLobbyRoute()
  const { data: match, error: connectionError, refresh, update } = useLobbyPolling(session, api.lobby.match, 1000, !leaving)
  const [expiredRoundId, setExpiredRoundId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const pollError = connectionError instanceof ApiError && (connectionError.status === 503 || !match)
    ? connectionError.message
    : null
  const roundNumber = match?.match.round?.number

  const loadIntelligence = useCallback((_id: string, signal?: AbortSignal) => {
    if (!session || roundNumber == null) return Promise.reject(new Error('There is no active round.'))
    return api.lobby.intelligence(code, roundNumber, session.token, signal)
  }, [code, roundNumber, session])

  const matchStatus = match?.match.status
  useEffect(() => {
    if (matchStatus === 'waiting') openWaitingRoom()
  }, [matchStatus, openWaitingRoom])

  if (!session) return null
  if (!match) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        {pollError ? <p role="alert" className="text-muted">{pollError}</p> : (
          <>
            <Spinner className="size-8 text-lime-300" />
            <p className="text-muted">Entering the match…</p>
          </>
        )}
        <Button variant="secondary" onClick={leave} loading={leaving}>Leave</Button>
      </div>
    )
  }

  const m = match.match
  const round = m.round
  const finished = m.status === 'finished'
  const activeRound = !finished && round && !m.reviewEndsAt ? round : null

  function onExpired() {
    if (!round || m.you.finalized) return
    setExpiredRoundId(round.id)
    void refresh()
  }

  async function submit(choice: GuessInput, final: boolean) {
    if (!round || !session || m.you.finalized) return
    try {
      const response = await api.lobby.guess(code, round.number, session.token, choice, final)
      // Apply acknowledgement before the next read completes.
      update((previous) => {
        if (!previous || previous.match.round?.id !== round.id) return previous
        const you = previous.match.you
        return {
          ...previous,
          match: {
            ...previous.match,
            you: {
              ...you,
              attemptsUsed: response.attemptsUsed ?? (you.attemptsTotal - response.attemptsRemaining),
              submittedGuesses: 'candidateId' in choice
                ? (you.submittedGuesses ?? [])
                : [...(you.submittedGuesses ?? []), { lat: choice.lat, lon: choice.lon }],
              submittedCandidateIds: 'candidateId' in choice
                ? [...(you.submittedCandidateIds ?? []), choice.candidateId]
                : (you.submittedCandidateIds ?? []),
              finalized: response.finalized,
            },
          },
        }
      })
    } finally {
      void refresh()
    }
  }

  async function unlock() {
    if (!round || !session) return
    const updated = await api.lobby.unlock(code, round.number, session.token)
    update((previous) => previous?.match.round?.id === round.id ? updated : previous)
    void refresh()
  }

  async function rematch() {
    try {
      const updated = await api.lobby.continue(code, session!.token)
      update(() => updated)
      void refresh()
    } catch {
      setError('Could not start the rematch.')
    }
  }


  return (
    <RoundStage
      round={!finished && round ? {
        ...round,
        rules: m.rules,
        selection: m.you.selection,
        selectedCandidateId: m.you.selectedCandidateId,
        submittedGuesses: m.you.submittedGuesses,
        submittedCandidateIds: m.you.submittedCandidateIds,
        attemptsUsed: m.you.attemptsUsed,
        attemptsTotal: m.you.attemptsTotal,
        endsAt: m.endsAt,
      } : null}
      hud={activeRound ? {
        roundsTotal: m.roundsTotal,
        score: m.leaderboard.find((entry) => entry.isYou)?.totalScore ?? 0,
        pauseExpiry: m.you.finalized,
        onExpired,
        onMenu: () => setExitOpen(true),
      } : undefined}
      controls={activeRound && !m.you.finalized && !m.roundComplete ? {
        disabled: leaving || expiredRoundId === activeRound.id,
        loadIntelligence,
        select: (point) => api.lobby.selection(code, session.token, point, activeRound.id),
        submit,
        unlock,
      } : undefined}
      error={error ?? (m.reviewEndsAt ? null : pollError)}
    >
      {activeRound && m.you.finalized && (
        <p role="status" className="surface absolute bottom-4 left-1/2 z-20 -translate-x-1/2 px-4 py-3 text-sm font-semibold text-cream">
          Guess locked. Waiting for the round to finish.
        </p>
      )}

      {m.reviewEndsAt && m.you.result && (
        <RoundResultOverlay
          result={m.you.result}
          leaderboard={m.leaderboard}
          endsAt={m.reviewEndsAt}
          lastRound={m.currentRound === m.roundsTotal}
          onExpired={() => void refresh()}
          error={pollError}
        />
      )}

      {/* Finished: final leaderboard */}
      {finished && (
        <FinalLeaderboard match={match} onRematch={rematch} onLeave={leave} onRefresh={() => void refresh()} />
      )}

      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave the match?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setExitOpen(false)}>
              Stay
            </Button>
            <Button variant="danger" fullWidth icon="exit" onClick={leave} loading={leaving}>
              Leave match
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Leaving now forfeits the current match for you.</p>
      </Dialog>
    </RoundStage>
  )
}

function Leaderboard({ entries, guesses }: {
  entries: LobbyLeaderboardEntry[]
  guesses?: LobbyParticipantGuess[]
}) {
  const guessesByMember = new Map(guesses?.map((guess) => [guess.memberId, guess]))
  return (
    <ol aria-label="Leaderboard" className="flex flex-col gap-2 text-left">
      {entries.map((entry) => {
        const guess = guessesByMember.get(entry.memberId)
        return (
          <li
            key={entry.memberId}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${entry.isYou ? 'border-lime-400/50 bg-lime-400/10' : 'border-white/8 bg-space-800'}`}
          >
            <span className="shrink-0 font-display font-semibold text-subtle">#{entry.rank}</span>
            <PlayerBadge name={entry.displayName} compact={Boolean(guesses)} />
            <div className="min-w-0 flex-1 wrap-anywhere">
              <p className="font-bold text-cream">
                {entry.displayName ?? 'Guest explorer'}
                {entry.isYou && <span className="ml-2 text-xs text-lime-300">(you)</span>}
              </p>
              {guess && <p className="text-xs text-muted">{guess.answer ?? (guess.guess ? formatCoordinates(guess.guess) : 'No guess')}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display font-semibold text-lime-300">{formatScore(entry.totalScore)} pts</p>
              {guess && <p className="text-xs text-muted">+{formatScore(guess.score)} this round</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const ignoreReviewDismissal = () => {}

function RoundResultOverlay({ result, leaderboard, endsAt, lastRound, onExpired, error }: {
  result: LobbyMatchResult
  leaderboard: LobbyLeaderboardEntry[]
  endsAt: string
  lastRound: boolean
  onExpired: () => void
  error: string | null
}) {
  const countdownLabel = lastRound ? 'Final standings in' : 'Next round in'
  const participantMarkers = useMemo(
    () => result.guesses.flatMap((guess) => guess.guess && !guess.isYou ? [{
      position: guess.guess,
      title: guess.displayName ?? 'Player',
    }] : []),
    [result],
  )

  return (
    <Dialog
      open
      onClose={ignoreReviewDismissal}
      dismissible={false}
      title={`Round ${result.roundNumber} results`}
      maxWidth="max-w-3xl"
      footer={
        <>
          {error && <p role="alert" className="mb-2 text-sm text-rose-300">{error}</p>}
          <div className="flex items-center justify-between gap-3 text-cream">
            <span>{countdownLabel}</span>
            <Timer endsAt={endsAt} onExpired={onExpired} label={countdownLabel} warningAtSeconds={0} />
          </div>
        </>
      }
    >
      <RoundResultDetails result={result} markers={participantMarkers} sideContent={
        <div>
          <p className="mb-2 text-sm text-muted">Actual location {formatCoordinates(result.actual)}</p>
          <h3 className="mb-2 font-display text-base text-cream">Leaderboard</h3>
          <Leaderboard entries={leaderboard} guesses={result.guesses} />
        </div>
      } />
    </Dialog>
  )
}

function FinalLeaderboard({
  match,
  onRematch,
  onLeave,
  onRefresh,
}: {
  match: LobbyMatchResponse
  onRematch: () => void
  onLeave: () => void
  onRefresh: () => void
}) {
  const entries = match.match.leaderboard
  const you = entries.find((entry) => entry.isYou)
  const prompt = match.match.continuePrompt
  const rematchActive = Boolean(prompt && prompt.readyPlayers.length > 0)

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-space-900/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
          <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-lime-400 text-ink">
            <Icon name="trophy" size={32} />
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold text-cream">Match complete</h1>
          {you && (
            <p className="mt-1 text-muted">
              You finished <span className="font-bold text-lime-300">#{you.rank}</span> with {formatScore(you.totalScore)} points.
            </p>
          )}

          <div className="mt-8">
            <Leaderboard entries={entries} />
          </div>

          {rematchActive && prompt && (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-space-800 px-4 py-3 text-left text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-cream">
                  {prompt.youRequested ? 'Rematch requested' : 'A rematch has been requested'}
                </p>
                {prompt.pendingPlayers.length > 0 && (
                  <p className="truncate text-xs text-muted">
                    Waiting for {prompt.pendingPlayers.join(', ')}
                  </p>
                )}
              </div>
              {prompt.deadline && (
                <Timer
                  endsAt={prompt.deadline}
                  onExpired={onRefresh}
                  label="Rematch window"
                  warningAtSeconds={10}
                />
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" icon="refresh" fullWidth onClick={onRematch} disabled={prompt?.youRequested}>
              {prompt?.youRequested ? 'Ready for rematch' : 'Rematch'}
            </Button>
            <Button size="lg" variant="secondary" icon="exit" fullWidth onClick={onLeave}>
              Leave
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
