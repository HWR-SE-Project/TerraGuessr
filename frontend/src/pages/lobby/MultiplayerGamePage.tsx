import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as lobbiesApi from '../../api/lobbies'
import { ApiError } from '../../api/client'
import type {
  LatLon,
  LobbyMatchDTO,
  LobbyMatchLeaderboardEntry,
  LobbyMatchParticipantGuess,
  LobbyMatchResponseDTO,
  LobbyMatchResult,
} from '../../api/types'
import type { StreetResult, StreetRound } from '../../api/singleplayer'
import { Brand } from '../../components/ui/Brand'
import { CandidateList } from '../../components/CandidateList'
import { StreetViewViewer } from '../singleplayer/StreetViewViewer'
import { GuessMap } from '../singleplayer/GuessMap'
import type { GuessMapMarker } from '../singleplayer/GuessMap'
import { GameplayHUD, GameIcon } from '../singleplayer/GameplayHUD'
import { GeographicIntelligence } from '../singleplayer/GeographicIntelligence'
import '../singleplayer/SingleplayerGamePage.css'
import './MultiplayerGamePage.css'

const POLL_INTERVAL_MS = 2000
const PARTICIPANT_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#f472b6',
  '#34d399',
  '#fb7185',
  '#facc15',
  '#c084fc',
  '#22d3ee',
]

function participantName(entry: LobbyMatchParticipantGuess): string {
  return entry.displayName?.trim() || 'Guest explorer'
}

function participantColor(
  entry: LobbyMatchParticipantGuess,
  index: number,
): string {
  return entry.isYou
    ? '#a78bfa'
    : PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]!
}

function participantAnswer(entry: LobbyMatchParticipantGuess): string {
  if (entry.answer) return entry.answer
  if (entry.guess) return coordinates(entry.guess)
  return 'No guess submitted'
}

function participantMarkers(
  guesses: LobbyMatchParticipantGuess[],
  roundNumber?: number,
): GuessMapMarker[] {
  return guesses.flatMap((entry, index) =>
    entry.guess && !entry.isYou
      ? [
          {
            position: entry.guess,
            title: `${roundNumber ? `Round ${roundNumber} · ` : ''}${participantName(entry)}: ${participantAnswer(entry)}`,
            color: participantColor(entry, index),
            label: String(index + 1),
          },
        ]
      : [],
  )
}

function distanceLabel(km: number | null): string {
  if (km === null) return 'No guess submitted'
  return km < 1
    ? `${Math.round(km * 1000).toLocaleString()} m`
    : `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
}

function clockLabel(seconds: number): string {
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function asStreetRound(round: LobbyMatchDTO['round']): StreetRound | null {
  if (!round) return null
  return {
    id: round.id,
    number: round.number,
    panoId: round.panoId,
    ...(round.candidates?.length ? { candidates: round.candidates } : {}),
  }
}

function asStreetResults(results: LobbyMatchResult[]): StreetResult[] {
  return results
    .filter((result) => result.guess !== null && result.distanceKm !== null)
    .map((result) => ({
      roundId: `round-${result.roundNumber}`,
      number: result.roundNumber,
      guess: result.guess!,
      actual: result.actual,
      distanceKm: result.distanceKm!,
      score: result.score,
    }))
}

function Leaderboard({
  entries,
  roundsTotal,
  compact = false,
}: {
  entries: LobbyMatchLeaderboardEntry[]
  roundsTotal: number
  compact?: boolean
}) {
  return (
    <section
      className={`mp-leaderboard${compact ? ' mp-leaderboard-compact' : ''}`}
      aria-label="Lobby leaderboard"
    >
      <header>
        <span>Leaderboard</span>
        <small>{entries.length} players</small>
      </header>
      <ol>
        {entries.map((entry) => (
          <li key={`${entry.rank}-${entry.displayName ?? 'guest'}`}>
            <span className="mp-rank">{entry.rank}</span>
            <span className="mp-player">
              <strong>{entry.displayName || 'Guest explorer'}</strong>
              <small>
                {entry.roundsCompleted} / {roundsTotal} rounds
                {entry.isHost ? ' · Host' : ''}
                {entry.isYou ? ' · You' : ''}
              </small>
            </span>
            <strong className="mp-points">
              {entry.totalScore.toLocaleString()}
            </strong>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ParticipantGuesses({
  guesses,
  roundNumber,
}: {
  guesses: LobbyMatchParticipantGuess[]
  roundNumber?: number
}) {
  if (!guesses.length) return null
  return (
    <section className="mp-participant-guesses" aria-label="Participant guesses">
      <span className="sp-eyebrow">
        {roundNumber ? `ROUND ${roundNumber} GUESSES` : 'PARTICIPANT GUESSES'}
      </span>
      <ul>
        {guesses.map((entry, index) => (
          <li key={`${participantName(entry)}-${index}`}>
            <span
              className="mp-guess-dot"
              style={{ background: participantColor(entry, index) }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="mp-guess-player">
              <strong>
                {participantName(entry)}
                {entry.isYou ? ' · You' : ''}
              </strong>
              <small>{participantAnswer(entry)}</small>
            </span>
            <span className="mp-guess-score">
              {entry.guess ? `${entry.score.toLocaleString()} pts` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RoundResultCard({
  result,
  roundsTotal,
  entries,
  pendingPlayers,
}: {
  result: LobbyMatchResult
  roundsTotal: number
  entries: LobbyMatchLeaderboardEntry[]
  pendingPlayers: string[]
}) {
  const waiting = pendingPlayers.length > 0
  const streetResults = asStreetResults([result])
  const participantPins = participantMarkers(result.guesses, result.roundNumber)
  return (
    <section className="sp-results" aria-label="Round results">
      <div className="sp-result-map">
        {streetResults.length > 0 || participantPins.length > 0 ? (
          <GuessMap
            key={result.roundNumber}
            results={streetResults}
            markers={participantPins}
            interactive={false}
          />
        ) : (
          <div className="mp-no-guess">No guess was submitted this round.</div>
        )}
      </div>
      <div className="sp-result-body">
        <span className="sp-eyebrow">
          ROUND {result.roundNumber} OF {roundsTotal} COMPLETE
        </span>
        <h1>
          {result.score >= 4500
            ? 'Incredible instinct.'
            : result.score >= 2500
              ? 'Nicely explored.'
              : 'Every guess is a discovery.'}
        </h1>
        <p>
          {result.guess
            ? `You were ${distanceLabel(result.distanceKm)} from the correct location.`
            : 'You ran out of time before placing a guess.'}
        </p>
        <div className="sp-earned">
          <strong>{result.score.toLocaleString()}</strong>
          <span> / 5,000 points</span>
        </div>
        <div className="sp-score-track">
          <span style={{ width: `${result.score / 50}%` }} />
        </div>
        <div className="sp-result-coords">
          <span>
            Correct location<strong>{coordinates(result.actual)}</strong>
          </span>
          <span>
            Your guess
            <strong>
              {result.guess ? coordinates(result.guess) : 'No guess submitted'}
            </strong>
          </span>
        </div>
        <ParticipantGuesses
          guesses={result.guesses}
          roundNumber={result.roundNumber}
        />
        <Leaderboard
          entries={entries}
          roundsTotal={roundsTotal}
          compact
        />
      </div>
      <footer className="sp-result-actions mp-result-actions">
        <p className="mp-waiting" role="status">
          {waiting
            ? `Waiting for ${pendingPlayers.join(', ')} to finish this round…`
            : 'Everyone is ready. Starting the next round…'}
        </p>
      </footer>
    </section>
  )
}

function coordinates(point: LatLon): string {
  return `${Math.abs(point.lat).toFixed(3)}° ${point.lat >= 0 ? 'N' : 'S'}, ${Math.abs(point.lon).toFixed(3)}° ${point.lon >= 0 ? 'E' : 'W'}`
}

function FinalMatchResults({
  match,
  now,
  busy,
  onContinue,
  onHome,
}: {
  match: LobbyMatchDTO
  now: number
  busy: boolean
  onContinue: () => void
  onHome: () => void
}) {
  const streetResults = asStreetResults(match.results)
  const total = match.results.reduce((sum, result) => sum + result.score, 0)
  const mine = match.leaderboard.find((entry) => entry.isYou)
  const markers = match.results.flatMap((result) =>
    participantMarkers(result.guesses, result.roundNumber),
  )
  const prompt = match.continuePrompt
  const remainingSeconds = prompt
    ? Math.max(0, Math.ceil((Date.parse(prompt.deadline) - now) / 1000))
    : null
  const pending = prompt?.pendingPlayers ?? []
  return (
    <section
      className="sp-results sp-final mp-final-panel"
      aria-label="Final results"
    >
      <div className="sp-result-map">
        {streetResults.length > 0 || markers.length > 0 ? (
          <GuessMap
            key="final"
            results={streetResults}
            markers={markers}
            interactive={false}
          />
        ) : (
          <div className="mp-no-guess">No guesses were submitted.</div>
        )}
      </div>
      <div className="sp-result-body">
        <span className="sp-eyebrow">MULTIPLAYER · MATCH COMPLETE</span>
        <h1>{mine?.rank === 1 ? 'You win the expedition.' : 'A world of discoveries.'}</h1>
        <div className="sp-earned">
          <strong>{total.toLocaleString()}</strong>
          <span> / {(match.roundsTotal * 5000).toLocaleString()} points</span>
        </div>
        <Leaderboard
          entries={match.leaderboard}
          roundsTotal={match.roundsTotal}
          compact
        />
        <div className="sp-round-list">
          {match.results.map((result) => (
            <details key={result.roundNumber}>
              <summary>
                <span>Round {result.roundNumber}</span>
                <span>{distanceLabel(result.distanceKm)}</span>
                <strong>{result.score.toLocaleString()} pts</strong>
              </summary>
              <div>
                <p>Correct location: {coordinates(result.actual)}</p>
                <p>
                  Your guess:{' '}
                  {result.guess ? coordinates(result.guess) : 'No guess submitted'}
                </p>
                <ParticipantGuesses guesses={result.guesses} />
              </div>
            </details>
          ))}
        </div>
      </div>
      <footer className="sp-result-actions">
        {prompt && (
          <div className="mp-continue-prompt" role="status" aria-live="polite">
            <strong>
              {prompt.youRequested
                ? 'Ready to continue'
                : 'Keep playing or head home'}
            </strong>
            <p>
              {prompt.youRequested
                ? pending.length > 0
                  ? `Waiting for ${pending.join(', ')} to decide…`
                  : 'Starting a new game…'
                : remainingSeconds !== null
                  ? `Choose within ${clockLabel(remainingSeconds)} or you will be removed from the lobby.`
                  : 'Choose to continue or leave the lobby.'}
            </p>
            {prompt.readyPlayers.length > 0 && (
              <small>{prompt.readyPlayers.join(', ')} ready to continue.</small>
            )}
          </div>
        )}
        <button
          type="button"
          className="sp-primary tg-control tg-control--primary"
          onClick={onContinue}
          disabled={busy || prompt?.youRequested}
        >
          {prompt?.youRequested
            ? 'Waiting for players…'
            : busy
              ? 'Starting…'
              : 'Continue playing'}
          {!prompt?.youRequested && !busy && (
            <span aria-hidden="true">→</span>
          )}
        </button>
        <button
          type="button"
          className="sp-secondary tg-control"
          onClick={onHome}
          disabled={busy}
        >
          Return to main page
        </button>
      </footer>
    </section>
  )
}

export function MultiplayerGamePage() {
  const { code: routeCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const code = (routeCode ?? '').toUpperCase()
  const token = useMemo(() => lobbiesApi.getLobbyToken(code), [code])
  const [data, setData] = useState<LobbyMatchResponseDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [busy, setBusy] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [panoramaReady, setPanoramaReady] = useState(false)
  const [lastResult, setLastResult] = useState<LobbyMatchResult | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [showBoard, setShowBoard] = useState(false)
  const roundKey = data?.match.round?.id ?? null
  const previousRound = useRef<string | null>(null)
  const loadId = useRef(0)

  const applyMatch = useCallback((next: LobbyMatchResponseDTO) => {
    setData(next)
    // A rematch starts at round 1; discard a stale final-round result so the
    // new game does not briefly show the previous match's result screen.
    setLastResult((current) =>
      current &&
      next.match.round &&
      next.match.round.number < current.roundNumber
        ? null
        : current,
    )
  }, [])

  const backToLobby = useCallback(() => {
    navigate(`/lobby/${code}`)
  }, [code, navigate])

  const exitToMenu = useCallback(async () => {
    if (token) {
      await lobbiesApi.leaveLobby(code, token).catch(() => {})
      lobbiesApi.clearLobbyToken(code)
      lobbiesApi.clearCurrentLobbyCode()
    }
    navigate('/')
  }, [code, navigate, token])

  const continueMatch = useCallback(async () => {
    if (!token || continuing) return
    setContinuing(true)
    setError(null)
    try {
      const next = await lobbiesApi.continueLobbyMatch(code, token)
      applyMatch(next)
      if (next.match.status === 'waiting') {
        navigate(`/lobby/${code}`)
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        lobbiesApi.clearLobbyToken(code)
        lobbiesApi.clearCurrentLobbyCode()
        navigate('/multiplayer', { replace: true })
        return
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'The continuation request could not be submitted.',
      )
    } finally {
      setContinuing(false)
    }
  }, [applyMatch, code, continuing, navigate, token])

  useEffect(() => {
    if (!token) navigate(`/lobby/${code}`, { replace: true })
  }, [code, navigate, token])

  const load = useCallback(async () => {
    if (!token) return
    const requestId = loadId.current + 1
    loadId.current = requestId
    try {
      const next = await lobbiesApi.getLobbyMatch(code, token)
      if (loadId.current !== requestId) return
      applyMatch(next)
      setError(null)
    } catch (cause) {
      if (loadId.current !== requestId) return
      if (cause instanceof ApiError && cause.status === 404) {
        lobbiesApi.clearLobbyToken(code)
        lobbiesApi.clearCurrentLobbyCode()
        navigate('/multiplayer', { replace: true })
        return
      }
      setError(cause instanceof Error ? cause.message : 'The match could not be loaded.')
    }
  }, [applyMatch, code, navigate, token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    let timer: number | undefined
    const tick = async () => {
      await load()
      if (!cancelled) timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [load, token])

  useEffect(() => {
    if (!roundKey || previousRound.current === roundKey) return
    previousRound.current = roundKey
    setGuess(data?.match.you.selection ?? null)
    setPanoramaReady(false)
    setNotice(null)
  }, [data?.match.you.selection, roundKey])

  useEffect(() => {
    if (!data) return
    if (data.match.status !== 'playing' && data.match.status !== 'finished') {
      return
    }
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [data])

  useEffect(() => {
    if (data?.match.status === 'waiting') {
      navigate(`/lobby/${code}`, { replace: true })
    }
  }, [code, data?.match.status, navigate])

  useEffect(() => {
    if (!data || data.match.status !== 'playing') return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [data])

  useEffect(() => {
    if (!token || data?.match.status !== 'playing') return
    const forfeit = (event: PageTransitionEvent) => {
      if (event.persisted) return
      lobbiesApi.leaveLobbyBeacon(code, token)
    }
    window.addEventListener('pagehide', forfeit)
    return () => window.removeEventListener('pagehide', forfeit)
  }, [code, data?.match.status, token])

  const match = data?.match
  const round = match?.round ?? null
  useEffect(() => {
    if (!lastResult) return
    const next = match?.round?.number
    if (!next) return
    if (next <= lastResult.roundNumber) return
    const timer = window.setTimeout(() => setLastResult(null), 4000)
    return () => window.clearTimeout(timer)
  }, [lastResult, match?.round?.number])

  const streetRound = asStreetRound(round)
  const completedResult = lastResult
    ? match?.results.find(
        (entry) => entry.roundNumber === lastResult.roundNumber,
      )
    : null
  const result = match?.you.result ?? completedResult ?? lastResult
  const finalized = (match?.you.finalized ?? false) || lastResult !== null
  const exploring = Boolean(streetRound && !finalized && match?.status === 'playing')
  const remainingSeconds =
    match?.endsAt !== null && match?.endsAt !== undefined
      ? Math.ceil((Date.parse(match.endsAt) - now) / 1000)
      : null
  const selectedCandidateId =
    round?.candidates?.find(
      (candidate) =>
        guess && candidate.lat === guess.lat && candidate.lon === guess.lon,
    )?.id ?? null

  const choose = useCallback(
    (point: LatLon) => {
      setGuess(point)
      if (token && match?.status === 'playing' && round) {
        void lobbiesApi
          .saveLobbySelection(code, token, point)
          .catch(() => {})
      }
    },
    [code, match?.status, round, token],
  )

  const loadIntelligence = useCallback(
    (_roundId: string, signal?: AbortSignal) => {
      const number = data?.match.currentRound
      if (!token || !number) {
        return Promise.reject(new Error('No active round.'))
      }
      return lobbiesApi.getLobbyIntelligence(code, number, token, signal)
    },
    [code, data?.match.currentRound, token],
  )

  async function submit(final = false) {
    if (!token || !match || !round || !guess || finalized || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = final
        ? await lobbiesApi.finishLobbyRound(code, round.number, token)
        : await lobbiesApi.submitLobbyGuess(
            code,
            round.number,
            token,
            guess,
            false,
          )
      if (!response.finalized) {
        setNotice(
          `Guess submitted. ${response.attemptsRemaining} attempt${response.attemptsRemaining === 1 ? '' : 's'} remaining.`,
        )
      } else if (response.result) {
        setLastResult(response.result)
      }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The guess could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) return null

  return (
    <main
      className="sp-page mp-page"
      aria-label="TerraGuessr multiplayer game"
      data-game-phase={
        match?.status === 'finished'
          ? 'game-completed'
          : finalized
            ? 'round-results'
            : match?.status === 'playing'
              ? 'exploring'
              : 'not-started'
      }
    >
      {streetRound && !finalized && (
        <StreetViewViewer
          round={streetRound}
          onReady={setPanoramaReady}
          showCompass
          scrollZoom
        />
      )}
      <div className="sp-top-shade" />
      <button
        className="sp-brand"
        aria-label="Back to lobby"
        onClick={backToLobby}
      >
        <Brand />
      </button>
      <div className="sp-top-controls">
        <button
          className="sp-icon tg-control sp-glass"
          aria-label="Show leaderboard"
          onClick={() => setShowBoard((value) => !value)}
        >
          <GameIcon name="info" />
        </button>
        <button
          className="sp-icon tg-control sp-glass"
          aria-label="Back to lobby"
          onClick={backToLobby}
        >
          <GameIcon name="return" />
        </button>
      </div>

      {match?.status === 'finished' ? (
        <FinalMatchResults
          match={match}
          now={now}
          busy={continuing}
          onContinue={() => void continueMatch()}
          onHome={() => void exitToMenu()}
        />
      ) : finalized && result ? (
        <RoundResultCard
          result={result}
          roundsTotal={match?.roundsTotal ?? 5}
          entries={match?.leaderboard ?? []}
          pendingPlayers={
            match?.currentRound === result.roundNumber
              ? (match.pendingPlayers ?? [])
              : []
          }
        />
      ) : null}

      {exploring && streetRound && match && (
        <GeographicIntelligence
          key={`${streetRound.id}:${streetRound.panoId}`}
          load={loadIntelligence}
          round={streetRound}
          defaultExpanded={match.difficulty !== 'hard'}
        />
      )}

      {!result && !finalized && match?.status === 'playing' && (
        <aside
          className="sp-guess-panel sp-glass mp-guess-panel"
          aria-label="Guessing map"
        >
          <header className="sp-map-header">
            <span className="sp-map-mode">
              <GameIcon name="pin" />
              <span>
                {round?.candidates ? 'Pick a city' : 'World Explorer'}
                <small>
                  {match.you.attemptsUsed} / {match.you.attemptsTotal} attempts
                  used
                </small>
              </span>
            </span>
          </header>
          <div className="sp-map-wrap">
            {round?.candidates ? (
              <CandidateList
                candidates={round.candidates}
                onChange={choose}
                selectedId={selectedCandidateId}
              />
            ) : (
              <GuessMap
                key={round?.id ?? 'match'}
                guess={guess}
                onChange={choose}
                interactive={exploring && panoramaReady && !busy}
              />
            )}
            {!round?.candidates && !guess && panoramaReady && (
              <span className="sp-map-hint">Click the map to place your pin</span>
            )}
          </div>
          <div className="sp-map-footer">
            <span aria-live="polite">
              {guess
                ? `${guess.lat.toFixed(3)}°, ${guess.lon.toFixed(3)}° · pin placed`
                : 'Where in the world are you?'}
            </span>
            {notice && (
              <p className="mp-inline-notice" role="status">
                {notice}
              </p>
            )}
            <div className="mp-guess-actions">
              <button
                className="sp-primary tg-control tg-control--primary sp-guess-button"
                disabled={!guess || !panoramaReady || busy}
                onClick={() => void submit(false)}
              >
                <GameIcon name="pin" />
                {busy ? 'Submitting…' : 'Submit guess'}
              </button>
              {match.you.attemptsUsed > 0 && (
                <button
                  className="sp-secondary tg-control"
                  disabled={!guess || busy}
                  onClick={() => void submit(true)}
                >
                  Final submit
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {match && !result && !finalized && match.status === 'playing' && (
        <div className={`mp-hud-stack${showBoard ? ' mp-hud-stack-open' : ''}`}>
          <div className="mp-timer" role="timer" aria-label="Time remaining">
            <span>Time left</span>
            <strong className={remainingSeconds !== null && remainingSeconds <= 30 ? 'mp-timer-low' : ''}>
              {remainingSeconds === null ? '—' : clockLabel(remainingSeconds)}
            </strong>
          </div>
          <Leaderboard
            entries={match.leaderboard}
            roundsTotal={match.roundsTotal}
            compact
          />
        </div>
      )}

      {match?.status !== 'finished' && (
        <GameplayHUD
          round={match?.currentRound ?? match?.roundsTotal ?? 1}
          roundsTotal={match?.roundsTotal ?? 5}
          score={match?.results.reduce((sum, entry) => sum + entry.score, 0) ?? 0}
          status={
            busy
              ? 'Submitting your guess…'
              : finalized
                ? 'Round complete'
                : 'Explore. Find your bearings.'
          }
        />
      )}

      {error && (
        <div className="sp-error sp-glass" role="alert">
          {error}
        </div>
      )}
    </main>
  )
}
