import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Difficulty, GuessInput, StreetResult, StreetRound } from '../../lib/contracts'
import { api } from '../../services'
import { useGameCredentials, setGameCredentials } from '../../state/game'
import { RoundResultDetails } from '../../components/game/RoundResultDetails'
import { RoundStage } from '../../components/game/RoundStage'
import { Button, Spinner } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { formatDistance, formatScore } from '../../lib/format'

type Phase = 'loading' | 'playing' | 'result' | 'summary' | 'error'

export function SingleplayerGamePage() {
  const navigate = useNavigate()
  const credentials = useGameCredentials()

  const [phase, setPhase] = useState<Phase>('loading')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [roundsTotal, setRoundsTotal] = useState<number | null>(null)
  const [round, setRound] = useState<StreetRound | null>(null)
  const [results, setResults] = useState<StreetResult[]>([])
  const [expiredRoundId, setExpiredRoundId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const ended = useRef(false)
  const totalScore = results.reduce((sum, result) => sum + result.score, 0)
  const isSessionComplete = roundsTotal !== null && results.length >= roundsTotal

  const loadIntelligence = useCallback((id: string, signal?: AbortSignal) => {
    if (!credentials) return Promise.reject(new Error('The game session has ended.'))
    return api.singleplayer.intelligence(credentials, id, signal)
  }, [credentials])

  const startRound = useCallback(async () => {
    if (!credentials) return
    setSubmitting(true)
    setError(null)
    try {
      const next = await api.singleplayer.next(credentials)
      setRound(next)
      setExpiredRoundId(null)
      setPhase('playing')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the round.')
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }, [credentials])

  useEffect(() => {
    if (!credentials) {
      if (!ended.current) navigate('/singleplayer', { replace: true })
      return
    }
    let active = true
    void (async () => {
      try {
        const session = await api.singleplayer.session(credentials)
        if (!active) return
        const sessionRoundsTotal = session.roundsTotal ?? null
        const sessionCompleted =
          session.completed ?? (sessionRoundsTotal !== null && session.results.length >= sessionRoundsTotal)
        setDifficulty(session.difficulty)
        setRoundsTotal(sessionRoundsTotal)
        setResults(session.results)
        if (session.activeRound) {
          setRound(session.activeRound)
          setPhase('playing')
        } else if (sessionCompleted) {
          try {
            await api.singleplayer.end(credentials)
          } catch {
            /* best-effort */
          }
          if (!active) return
          ended.current = true
          setPhase('summary')
          setGameCredentials(null)
        } else {
          await startRound()
        }
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not load the game.')
        setPhase('error')
      }
    })()
    return () => {
      active = false
    }
  }, [credentials, navigate, startRound])

  useEffect(() => {
    if (!credentials || !expiredRoundId || phase !== 'playing') return
    let active = true
    let retry: number | undefined

    async function refreshResult() {
      if (!credentials) return
      try {
        const session = await api.singleplayer.session(credentials)
        if (!active) return
        if (session.results.some((result) => result.roundId === expiredRoundId)) {
          setResults(session.results)
          setError(null)
          setPhase('result')
          return
        }
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not load the round result.')
      }
      retry = window.setTimeout(refreshResult, 1000)
    }

    void refreshResult()
    return () => {
      active = false
      window.clearTimeout(retry)
    }
  }, [credentials, expiredRoundId, phase])

  async function submit(choice: GuessInput, final: boolean) {
    if (!credentials || !round) return
    const response = await api.singleplayer.guess(credentials, round.id, choice, final)
    if (ended.current) return
    if (response.result) {
      const result = response.result
      setResults((previous) => [...previous.filter((entry) => entry.roundId !== result.roundId), result])
      setPhase('result')
    } else {
      setRound((current) => current?.id === round.id ? {
        ...current,
        attemptsUsed: current.attemptsTotal - response.attemptsRemaining,
        submittedGuesses: 'candidateId' in choice
          ? (current.submittedGuesses ?? [])
          : [...(current.submittedGuesses ?? []), { lat: choice.lat, lon: choice.lon }],
        submittedCandidateIds: 'candidateId' in choice
          ? [...(current.submittedCandidateIds ?? []), choice.candidateId]
          : (current.submittedCandidateIds ?? []),
      } : current)
    }
  }

  async function unlock() {
    if (!credentials || !round) return
    const updated = await api.singleplayer.unlock(credentials, round.id)
    setRound((current) => current?.id === round.id ? updated : current)
  }

  async function endSession() {
    if (!credentials || ended.current) return
    setExitOpen(false)
    setSubmitting(true)
    try {
      await api.singleplayer.end(credentials)
    } catch {
      /* best-effort */
    } finally {
      setSubmitting(false)
    }
    ended.current = true
    setPhase('summary')
    setGameCredentials(null)
  }

  async function playAgain() {
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.singleplayer.create(difficulty, roundsTotal)
      ended.current = false
      setResults([])
      setRound(null)
      setExpiredRoundId(null)
      setPhase('loading')
      setGameCredentials(created)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start a new game.')
    } finally {
      setSubmitting(false)
    }
  }

  async function exitToSetup() {
    if (credentials) {
      try {
        await api.singleplayer.end(credentials)
      } catch {
        /* best-effort */
      }
      setGameCredentials(null)
    }
    navigate('/singleplayer')
  }

  if (!credentials && phase !== 'summary') return null

  return (
    <RoundStage
      round={phase === 'summary' || phase === 'error' ? null : round}
      hud={phase === 'playing' && round ? {
        score: totalScore,
        roundsTotal: roundsTotal ?? undefined,
        onExpired: () => setExpiredRoundId(round.id),
        onLeave: () => setExitOpen(true),
      } : undefined}
      controls={phase === 'playing' && round && credentials ? {
        disabled: expiredRoundId === round.id,
        loadIntelligence,
        select: (point) => api.singleplayer.selection(credentials, round.id, point),
        submit,
        unlock,
      } : undefined}
      error={phase === 'error' ? null : error}
    >
      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Spinner className="size-8 text-lime-300" />
          <p className="text-muted">Preparing your round…</p>
        </div>
      )}

      {phase === 'error' && (
        <StartErrorScreen
          message={error ?? 'Could not start the round.'}
          hasCompletedRounds={results.length > 0}
          retrying={submitting}
          onRetry={() => void startRound()}
          onViewSummary={() => {
            setError(null)
            setPhase('summary')
          }}
          onBack={() => void exitToSetup()}
        />
      )}

      <RoundResult
        open={phase === 'result'}
        result={results.at(-1) ?? null}
        totalScore={totalScore}
        roundNumber={round?.number ?? results.at(-1)?.number ?? 0}
        roundsTotal={roundsTotal}
        isFinalRound={isSessionComplete}
        onNext={startRound}
        onFinish={endSession}
        starting={submitting}
      />

      {phase === 'summary' && (
        <SessionSummary
          totalScore={totalScore}
          results={results}
          roundsTotal={roundsTotal}
          restarting={submitting}
          onPlayAgain={playAgain}
          onHome={() => navigate('/')}
        />
      )}

      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="End your session?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setExitOpen(false)}>
              Keep exploring
            </Button>
            <Button variant="danger" fullWidth icon="exit" onClick={endSession}>
              End session
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Your score so far — <span className="font-bold text-cream">{formatScore(totalScore)} points</span> across{' '}
          {roundsTotal !== null
            ? `${results.length} of ${roundsTotal} rounds`
            : `${results.length} round${results.length === 1 ? '' : 's'}`} — will be saved. Ready to{' '}
          {roundsTotal !== null ? 'end early?' : 'call it a day?'}
        </p>
      </Dialog>
    </RoundStage>
  )
}

function RoundResult({
  open,
  result,
  totalScore,
  roundNumber,
  roundsTotal,
  isFinalRound,
  onNext,
  onFinish,
  starting,
}: {
  open: boolean
  result: StreetResult | null
  totalScore: number
  roundNumber: number
  roundsTotal: number | null
  isFinalRound: boolean
  onNext: () => void
  onFinish: () => void
  starting: boolean
}) {
  return (
    <Dialog open={open} onClose={() => {}} dismissible={false} maxWidth="max-w-lg" title={`Round ${roundNumber} result`}>
      {result && (
        <div className="flex flex-col gap-4">
          <RoundResultDetails result={result} />

          <div className="flex items-center justify-between rounded-2xl bg-space-800 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-muted">Total score</span>
              {roundsTotal !== null && (
                <p className="text-xs font-bold text-subtle">
                  {isFinalRound ? `Final round · ${roundNumber} of ${roundsTotal}` : `Round ${roundNumber} of ${roundsTotal}`}
                </p>
              )}
            </div>
            <span className="font-display text-xl font-semibold text-lime-300">{formatScore(totalScore)}</span>
          </div>

          {isFinalRound ? (
            <Button fullWidth size="lg" icon="trophy" onClick={onFinish} loading={starting}>
              View summary
            </Button>
          ) : (
            <Button fullWidth size="lg" icon="chevronRight" onClick={onNext} loading={starting}>
              Next round
            </Button>
          )}
        </div>
      )}
    </Dialog>
  )
}

function SessionSummary({
  totalScore,
  results,
  roundsTotal,
  restarting,
  onPlayAgain,
  onHome,
}: {
  totalScore: number
  results: StreetResult[]
  roundsTotal: number | null
  restarting: boolean
  onPlayAgain: () => void
  onHome: () => void
}) {
  const best = useMemo(() => results.reduce((max, r) => Math.max(max, r.score), 0), [results])
  const average = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0
  const finishedAllRounds = roundsTotal !== null && results.length >= roundsTotal

  return (
    <div className="scroll-thin absolute inset-0 z-30 overflow-y-auto bg-space-900/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-8 text-center sm:py-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
          <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-lime-400 text-ink">
            <Icon name="trophy" size={32} />
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold text-cream">Well explored!</h1>
          <p className="mt-1 text-muted">
            {finishedAllRounds
              ? `You completed all ${roundsTotal} rounds.`
              : "Here's how your journey went."}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Total score" value={formatScore(totalScore)} accent />
            <Stat label="Rounds" value={roundsTotal !== null ? `${results.length} / ${roundsTotal}` : String(results.length)} />
            <Stat label="Best round" value={formatScore(best)} />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-subtle">
            <Icon name="star" size={16} className="text-amber-300" />
            Average {formatScore(average)} points per round
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" icon="play" fullWidth loading={restarting} onClick={onPlayAgain}>
              Play again
            </Button>
            <Button size="lg" variant="secondary" fullWidth disabled={restarting} onClick={onHome}>
              Back home
            </Button>
          </div>

          {results.length > 0 && (
            <section aria-label="Round breakdown" className="mt-6 text-left">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-subtle">Round breakdown</h2>
                <span className="text-xs font-bold text-subtle">
                  {results.length} {results.length === 1 ? 'round' : 'rounds'}
                </span>
              </div>
              <div className="scroll-thin flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 sm:max-h-80">
                {results.map((result) => (
                  <div key={result.roundId} className="surface-flat grid grid-cols-3 items-center px-4 py-3">
                    <span className="text-sm font-semibold text-cream">Round {result.number}</span>
                    <span className="text-center text-sm tabular-nums text-muted">{formatDistance(result.distanceKm)}</span>
                    <span className="text-right font-display font-semibold tabular-nums text-lime-300">+{formatScore(result.score)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function StartErrorScreen({
  message,
  hasCompletedRounds,
  retrying,
  onRetry,
  onViewSummary,
  onBack,
}: {
  message: string
  hasCompletedRounds: boolean
  retrying: boolean
  onRetry: () => void
  onViewSummary: () => void
  onBack: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-space-900/95 px-4 py-12 backdrop-blur-sm">
      <div className="surface flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-3xl bg-rose-400/15 text-rose-300">
          <Icon name="info" size={28} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-cream">
            {hasCompletedRounds ? 'Could not load the next round' : 'Could not start the game'}
          </h1>
          <p role="alert" className="mt-2 text-sm leading-relaxed text-rose-300">
            {message}
          </p>
        </div>
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
          <Button size="lg" icon="refresh" fullWidth loading={retrying} onClick={onRetry}>
            Try again
          </Button>
          {hasCompletedRounds ? (
            <Button size="lg" variant="secondary" fullWidth onClick={onViewSummary}>
              View summary
            </Button>
          ) : (
            <Button size="lg" variant="secondary" fullWidth onClick={onBack}>
              Back to setup
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface-flat px-3 py-4">
      <p className={`font-display text-2xl font-semibold ${accent ? 'text-lime-300' : 'text-cream'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-subtle">{label}</p>
    </div>
  )
}
