import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LatLon, LobbyMatchResponse } from '../../lib/contracts'
import { api } from '../../services'
import { useLobbySession, clearLobbySession } from '../../state/lobby'
import { StreetView } from '../../components/game/StreetView'
import { GuessMap } from '../../components/game/GuessMap'
import { CandidateList } from '../../components/game/CandidateList'
import { GeographicIntelligence } from '../../components/game/GeographicIntelligence'
import { Timer } from '../../components/game/Timer'
import { TopHud } from '../../components/game/TopHud'
import { Button, Spinner } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { formatDistance, formatScore, hueFromString, initials } from '../../lib/format'
import { difficultyInfo } from '../../lib/difficulty'

export function MultiplayerGamePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const session = useLobbySession()

  const [match, setMatch] = useState<LobbyMatchResponse | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(true)
  const [exitOpen, setExitOpen] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    try {
      const data = await api.lobby.match(code, session.token)
      setMatch(data)
    } catch {
      /* transient — keep polling */
    }
  }, [session, code])

  useEffect(() => {
    if (!session || session.code !== code.toUpperCase()) {
      navigate('/multiplayer', { replace: true })
      return
    }
    void load()
    const interval = window.setInterval(() => void load(), 1000)
    return () => window.clearInterval(interval)
  }, [session, code, load, navigate])

  // Reset local guess when the round changes.
  useEffect(() => {
    setGuess(null)
    setSelectedCity(null)
  }, [match?.match.round?.id])

  if (!session || !match) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <Spinner className="size-8 text-lime-300" />
        <p className="text-muted">Entering the match…</p>
      </div>
    )
  }

  const { lobby, match: m } = match
  const info = difficultyInfo(lobby.difficulty)
  const round = m.round
  const finished = m.status === 'finished'
  const showResult = !finished && m.roundComplete

  async function submit(final: boolean, point?: LatLon) {
    if (!round) return
    const target = point ?? guess
    if (!target) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await api.lobby.guess(code, round.number, session!.token, target, final)
      if (response.finalized) {
        // Refresh immediately to surface the round result.
        await load()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the guess.')
    } finally {
      setSubmitting(false)
    }
  }

  // R08: persist the current pin server-side on every change (best-effort),
  // so a round that times out without reaching this client's own final
  // submit (closed tab, dropped network) still has a guess to fall back to.
  function pushSelection(point: LatLon) {
    if (!session || !round) return
    void api.lobby.selection(code, session.token, point).catch(() => {})
  }

  function updateGuess(point: LatLon) {
    setGuess(point)
    pushSelection(point)
  }

  function onExpired() {
    if (round) {
      const target = guess ?? { lat: 0, lon: 0 }
      void submit(true, target)
    }
  }

  async function rematch() {
    try {
      await api.lobby.continue(code, session!.token)
      setGuess(null)
      await load()
    } catch {
      setError('Could not start the rematch.')
    }
  }

  async function leave() {
    try {
      await api.lobby.leave(code, session!.token)
    } catch {
      /* best-effort */
    }
    clearLobbySession()
    navigate('/multiplayer')
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-900">
      {!finished && round && (
        <div className="absolute inset-0">
          <StreetView panoId={round.panoId} />
        </div>
      )}

      {!finished && round && (
        <TopHud
          round={round.number}
          roundsTotal={m.roundsTotal}
          score={m.leaderboard.find((entry) => entry.isYou)?.totalScore ?? 0}
          attemptsUsed={m.you.attemptsUsed}
          attemptsTotal={m.you.attemptsTotal}
          timer={<Timer endsAt={round.endsAt} paused={submitting} onExpired={onExpired} />}
          onMenu={() => setExitOpen(true)}
        />
      )}

      {/* Live leaderboard strip */}
      {!finished && (
        <div className="pointer-events-none absolute right-3 top-20 z-20 hidden sm:right-4 sm:block">
          <LeaderboardCard match={match} />
        </div>
      )}

      {/* Guess controls */}
      {!finished && round && !m.roundComplete && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 pb-safe sm:p-4 lg:inset-x-auto lg:left-4 lg:top-20 lg:bottom-4 lg:w-[380px] lg:justify-between">
          <GeographicIntelligence
            roundId={round.id}
            roundKey={`${round.id}-${round.panoId}`}
            load={() => api.lobby.intelligence(code, round.number, session!.token)}
            access={round.extraData}
            onUnlock={async () => {
              await api.lobby.unlock(code, round.number, session!.token)
              await load()
            }}
          />

          <div className="surface-flat overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-display text-sm font-semibold text-cream">
                {round.candidates?.length ? 'Pick a city' : 'Place your pin'}
              </span>
              <button type="button" onClick={() => setMapOpen((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-muted">
                {mapOpen ? 'Hide' : 'Show'}
                <Icon name={mapOpen ? 'chevronDown' : 'chevronRight'} size={14} />
              </button>
            </div>
            {mapOpen && (
              <div className="px-3 pb-3">
                {round.candidates?.length ? (
                  <CandidateList
                    candidates={round.candidates}
                    selected={selectedCity}
                    onSelect={(c) => {
                      setSelectedCity(c.id)
                      updateGuess({ lat: c.lat, lon: c.lon })
                    }}
                  />
                ) : (
                  <div className="h-60 overflow-hidden rounded-2xl lg:h-72">
                    <GuessMap guess={guess} onChange={updateGuess} interactive={!submitting} countryBorders={info.countryBorders} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-subtle">
                    {guess ? `${guess.lat.toFixed(2)}°, ${guess.lon.toFixed(2)}°` : round.candidates?.length ? 'Choose a city' : 'Tap the map to place a pin'}
                  </span>
                  {m.you.attemptsUsed > 0 && m.you.attemptsUsed < m.you.attemptsTotal && (
                    <span className="text-xs font-bold text-amber-300">
                      {m.you.attemptsTotal - m.you.attemptsUsed} {m.you.attemptsTotal - m.you.attemptsUsed === 1 ? 'try' : 'tries'} left
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button fullWidth icon="pin" disabled={!guess || submitting} loading={submitting} onClick={() => submit(false)}>
                    Submit guess
                  </Button>
                  {m.you.attemptsUsed > 0 && m.you.attemptsUsed < m.you.attemptsTotal && (
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

      {/* Round result overlay */}
      <AnimatePresence>
        {showResult && !finished && (
          <RoundResultOverlay match={match} />
        )}
      </AnimatePresence>

      {/* Finished: final leaderboard */}
      {finished && (
        <FinalLeaderboard match={match} onRematch={rematch} onLeave={leave} />
      )}

      {error && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-rose-400/90 px-4 py-2 text-sm font-bold text-space-950">
          {error}
        </div>
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
            <Button variant="danger" fullWidth icon="exit" onClick={leave}>
              Leave match
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Leaving now forfeits the current match for you.</p>
      </Dialog>
    </div>
  )
}

function LeaderboardCard({ match }: { match: LobbyMatchResponse }) {
  const entries = match.match.leaderboard
  return (
    <div className="surface-flat w-56 p-3">
      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-subtle">Leaderboard</p>
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <div
            key={entry.displayName ?? entry.rank}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${entry.isYou ? 'bg-lime-400/12' : ''}`}
          >
            <span className="w-4 text-center font-display text-sm font-semibold text-subtle">{entry.rank}</span>
            <span className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-ink" style={{ background: `hsl(${hueFromString(entry.displayName ?? '?')} 70% 72%)` }}>
              {initials(entry.displayName ?? '?')}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-cream">{entry.displayName}</span>
            <span className="font-display text-sm font-semibold text-lime-300">{formatScore(entry.totalScore)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoundResultOverlay({ match }: { match: LobbyMatchResponse }) {
  const result = match.match.you.result
  const pending = match.match.pendingPlayers
  const participantMarkers = useMemo(
    () =>
      (result?.guesses ?? [])
        .filter((g) => g.guess)
        .map((g) => ({
          position: g.guess!,
          title: g.displayName ?? 'Player',
          color: g.isYou ? '#c0f66b' : '#ffb45e',
        })),
    [result],
  )

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-space-950/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} className="surface w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-cream">Round {result?.roundNumber} results</h2>
          {pending.length > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-space-800 px-3 py-1 text-xs font-bold text-amber-300">
              <Spinner className="size-3.5" /> Waiting for {pending.join(', ')}
            </span>
          ) : (
            <span className="rounded-full bg-lime-400/15 px-3 py-1 text-xs font-bold text-lime-300">Starting next round…</span>
          )}
        </div>

        {result && (
          <>
            <div className="mt-4 flex items-end justify-center gap-10">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-subtle">Your distance</p>
                <p className="font-display text-3xl font-semibold text-cream">{formatDistance(result.distanceKm)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-subtle">Points</p>
                <p className="font-display text-3xl font-semibold text-lime-300">+{formatScore(result.score)}</p>
              </div>
            </div>

            <div className="mt-4 h-52 overflow-hidden rounded-2xl">
              <GuessMap interactive={false} markers={participantMarkers} results={[{ actual: result.actual, guess: result.guess }]} />
            </div>

            <div className="mt-4 max-h-40 overflow-y-auto">
              <LeaderboardCard match={match} />
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function FinalLeaderboard({
  match,
  onRematch,
  onLeave,
}: {
  match: LobbyMatchResponse
  onRematch: () => void
  onLeave: () => void
}) {
  const entries = match.match.leaderboard
  const you = entries.find((entry) => entry.isYou)

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

          <div className="mt-8 flex flex-col gap-2 text-left">
            {entries.map((entry) => (
              <div
                key={entry.displayName ?? entry.rank}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  entry.isYou ? 'border-lime-400/50 bg-lime-400/10' : 'border-white/8 bg-space-800'
                }`}
              >
                <span className={`font-display text-2xl font-semibold ${entry.rank === 1 ? 'text-amber-300' : 'text-subtle'}`}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                </span>
                <span className="flex size-9 items-center justify-center rounded-full font-display font-semibold text-ink" style={{ background: `hsl(${hueFromString(entry.displayName ?? '?')} 70% 72%)` }}>
                  {initials(entry.displayName ?? '?')}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold text-cream">
                  {entry.displayName}
                  {entry.isYou && <span className="ml-2 text-xs text-lime-300">(you)</span>}
                </span>
                <span className="font-display font-semibold text-lime-300">{formatScore(entry.totalScore)}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" icon="refresh" fullWidth onClick={onRematch}>
              Rematch
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
