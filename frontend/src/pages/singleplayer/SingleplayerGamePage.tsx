import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Difficulty, LatLon, StreetResult, StreetRound } from '../../lib/contracts'
import { api } from '../../services'
import { useGameCredentials, setGameCredentials } from '../../state/game'
import { StreetView } from '../../components/game/StreetView'
import { GuessMap } from '../../components/game/GuessMap'
import { CandidateList } from '../../components/game/CandidateList'
import { GeographicIntelligence } from '../../components/game/GeographicIntelligence'
import { Timer } from '../../components/game/Timer'
import { TopHud } from '../../components/game/TopHud'
import { Button, Spinner } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { formatDistance, formatScore } from '../../lib/format'
import { difficultyInfo } from '../../lib/difficulty'

type Phase = 'loading' | 'playing' | 'result' | 'summary'

export function SingleplayerGamePage() {
  const navigate = useNavigate()
  const credentials = useGameCredentials()

  const [phase, setPhase] = useState<Phase>('loading')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [round, setRound] = useState<StreetRound | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [results, setResults] = useState<StreetResult[]>([])
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<StreetResult | null>(null)
  const [triesLeft, setTriesLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(true)

  const info = difficultyInfo(difficulty)
  const candidates = round?.candidates ?? []
  const attemptsTotal = round?.attemptsTotal ?? 0
  const attemptsUsed = round?.attemptsUsed ?? 0

  const startRound = useCallback(async () => {
    if (!credentials) return
    setSubmitting(true)
    try {
      const next = await api.singleplayer.next(credentials)
      setRound(next)
      setGuess(null)
      setSelectedCity(null)
      setLastResult(null)
      setTriesLeft(null)
      setPhase('playing')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the round.')
      setPhase('summary')
    } finally {
      setSubmitting(false)
    }
  }, [credentials])

  useEffect(() => {
    if (!credentials) {
      navigate('/singleplayer', { replace: true })
      return
    }
    let active = true
    void (async () => {
      try {
        const session = await api.singleplayer.session(credentials)
        if (!active) return
        setDifficulty(session.difficulty)
        setTotalScore(session.totalScore)
        setResults(session.results)
        if (session.activeRound) {
          setRound(session.activeRound)
          setPhase('playing')
        } else {
          await startRound()
        }
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not load the game.')
        setPhase('summary')
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials])

  async function submit(final: boolean, point?: LatLon) {
    if (!credentials || !round) return
    const target = point ?? guess
    if (!target) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await api.singleplayer.guess(credentials, round.id, target, final)
      if (response.finalized && response.result) {
        setLastResult(response.result)
        setResults((prev) => [...prev, response.result!])
        setTotalScore((prev) => prev + response.result!.score)
        setPhase('result')
      } else {
        setTriesLeft(response.attemptsRemaining)
        setRound({ ...round, attemptsUsed: round.attemptsTotal - response.attemptsRemaining })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the guess.')
    } finally {
      setSubmitting(false)
    }
  }

  function onExpired() {
    // Out of time: finalize with the current pin, or a guaranteed miss.
    if (guess) void submit(true, guess)
    else void submit(true, { lat: 0, lon: 0 })
  }

  function selectCandidate(id: string, point: LatLon) {
    setSelectedCity(id)
    setGuess(point)
  }

  async function endSession() {
    if (!credentials) return
    setExitOpen(false)
    try {
      await api.singleplayer.end(credentials)
    } catch {
      /* best-effort */
    }
    setGameCredentials(null)
    setPhase('summary')
  }

  async function playAgain() {
    const created = await api.singleplayer.create(difficulty)
    setGameCredentials(created)
    setResults([])
    setTotalScore(0)
    setLastResult(null)
    setRound(null)
    setPhase('loading')
    const session = await api.singleplayer.session(created)
    setDifficulty(session.difficulty)
    await startRound()
  }

  if (!credentials) return null

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-900">
      {phase !== 'summary' && round && (
        <div className="absolute inset-0">
          <StreetView panoId={round.panoId} />
        </div>
      )}

      {phase === 'playing' && round && (
        <TopHud
          round={round.number}
          score={totalScore}
          attemptsUsed={attemptsUsed}
          attemptsTotal={attemptsTotal}
          timer={<Timer endsAt={round.endsAt} paused={submitting} onExpired={onExpired} />}
          onMenu={() => setExitOpen(true)}
        />
      )}

      {phase === 'playing' && round && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 pb-safe sm:p-4 lg:inset-x-auto lg:left-4 lg:top-20 lg:bottom-4 lg:w-[380px] lg:justify-between">
          <GeographicIntelligence
            roundId={round.id}
            roundKey={`${round.id}-${round.panoId}`}
            load={(id, signal) => api.singleplayer.intelligence(credentials, id, signal)}
            access={round.extraData}
            onUnlock={() =>
              api.singleplayer
                .unlock(credentials, round.id)
                .then(setRound)
                .catch(() => setError('Could not unlock additional data.'))
            }
          />

          <div className="surface-flat overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-display text-sm font-semibold text-cream">
                {candidates.length ? 'Pick a city' : 'Place your pin'}
              </span>
              <button type="button" onClick={() => setMapOpen((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-muted">
                {mapOpen ? 'Hide' : 'Show'}
                <Icon name={mapOpen ? 'chevronDown' : 'chevronRight'} size={14} />
              </button>
            </div>
            {mapOpen && (
              <div className="px-3 pb-3">
                {candidates.length ? (
                  <CandidateList candidates={candidates} selected={selectedCity} onSelect={(c) => selectCandidate(c.id, { lat: c.lat, lon: c.lon })} />
                ) : (
                  <div className="h-60 overflow-hidden rounded-2xl lg:h-72">
                    <GuessMap guess={guess} onChange={setGuess} interactive={!submitting} countryBorders={info.countryBorders} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-subtle">
                    {guess ? `${guess.lat.toFixed(2)}°, ${guess.lon.toFixed(2)}° — pin placed` : candidates.length ? 'Choose a city to continue' : 'Tap the map to place a pin'}
                  </span>
                  {triesLeft != null && triesLeft > 0 && (
                    <span className="text-xs font-bold text-amber-300">{triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button fullWidth icon="pin" disabled={!guess || submitting} loading={submitting} onClick={() => submit(false)}>
                    Submit guess
                  </Button>
                  {attemptsUsed > 0 && attemptsUsed < attemptsTotal && (
                    <Button fullWidth variant="tinted" icon="check" disabled={!guess || submitting} onClick={() => submit(true)}>
                      Final
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && phase === 'playing' && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-rose-400/90 px-4 py-2 text-sm font-bold text-space-950">
          {error}
        </div>
      )}

      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Spinner className="size-8 text-lime-300" />
          <p className="text-muted">Preparing your round…</p>
        </div>
      )}

      <RoundResult
        open={phase === 'result'}
        result={lastResult}
        totalScore={totalScore}
        roundNumber={round?.number ?? 0}
        onNext={startRound}
      />

      {phase === 'summary' && (
        <SessionSummary totalScore={totalScore} results={results} onPlayAgain={playAgain} onHome={() => navigate('/')} />
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
          {results.length} round{results.length === 1 ? '' : 's'} — will be saved. Ready to call it a day?
        </p>
      </Dialog>
    </div>
  )
}

function RoundResult({
  open,
  result,
  totalScore,
  roundNumber,
  onNext,
}: {
  open: boolean
  result: StreetResult | null
  totalScore: number
  roundNumber: number
  onNext: () => void
}) {
  return (
    <Dialog open={open} onClose={() => {}} dismissible={false} maxWidth="max-w-lg" title={`Round ${roundNumber} result`}>
      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-center gap-10">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-subtle">Distance</p>
              <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-4xl font-semibold text-cream">
                {formatDistance(result.distanceKm)}
              </motion.p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-subtle">Points</p>
              <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.12 }} className="font-display text-4xl font-semibold text-lime-300">
                +{formatScore(result.score)}
              </motion.p>
            </div>
          </div>

          <div className="h-56 overflow-hidden rounded-2xl">
            <GuessMap interactive={false} results={[{ actual: result.actual, guess: result.guess }]} />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-space-800 px-4 py-3">
            <span className="text-sm font-semibold text-muted">Total score</span>
            <span className="font-display text-xl font-semibold text-lime-300">{formatScore(totalScore)}</span>
          </div>

          <Button fullWidth size="lg" icon="chevronRight" onClick={onNext}>
            Next round
          </Button>
        </div>
      )}
    </Dialog>
  )
}

function SessionSummary({
  totalScore,
  results,
  onPlayAgain,
  onHome,
}: {
  totalScore: number
  results: StreetResult[]
  onPlayAgain: () => void
  onHome: () => void
}) {
  const best = useMemo(() => results.reduce((max, r) => Math.max(max, r.score), 0), [results])
  const average = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-space-900/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
          <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-lime-400 text-ink">
            <Icon name="trophy" size={32} />
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold text-cream">Well explored!</h1>
          <p className="mt-1 text-muted">Here's how your journey went.</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="Total score" value={formatScore(totalScore)} accent />
            <Stat label="Rounds" value={String(results.length)} />
            <Stat label="Best round" value={formatScore(best)} />
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-sm text-subtle">
            <Icon name="star" size={16} className="text-amber-300" />
            Average {formatScore(average)} points per round
          </div>

          {results.length > 0 && (
            <div className="mt-8 flex flex-col gap-2 text-left">
              {results.map((result) => (
                <div key={result.roundId} className="surface-flat flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold text-cream">Round {result.number}</span>
                  <span className="text-sm text-muted">{formatDistance(result.distanceKm)}</span>
                  <span className="font-display font-semibold text-lime-300">+{formatScore(result.score)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" icon="play" fullWidth onClick={onPlayAgain}>
              Play again
            </Button>
            <Button size="lg" variant="secondary" fullWidth onClick={onHome}>
              Back home
            </Button>
          </div>
        </motion.div>
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
