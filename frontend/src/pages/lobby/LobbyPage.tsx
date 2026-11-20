import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import * as lobbiesApi from '../../api/lobbies'
import { ApiError } from '../../api/client'
import { mapApiError } from '../../api/errorMessages'
import { PageNavigation } from '../../components/ui/PageNavigation'
import { HomeIcon } from '../home/HomeIcon'
import { useSession } from '../../state/SessionContext'
import type { Difficulty, LobbyDTO } from '../../api/types'
import './LobbyPage.css'

const DIFFICULTIES: Array<{
  value: Difficulty
  label: string
  detail: string
}> = [
  { value: 'easy', label: 'Easy', detail: '7 min · 3 attempts · pick from a list' },
  { value: 'medium', label: 'Medium', detail: '4 min · 2 attempts · world map' },
  { value: 'hard', label: 'Hard', detail: '2 min · 1 attempt · world map' },
]

const ROUND_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 3)
const POLL_INTERVAL_MS = 3000
const FEEDBACK_TIMEOUT_MS = 5000
const CODE_PATTERN = /^[A-Z0-9]{6}$/

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`
}

function memberName(name: string | null): string {
  return name && name.length > 0 ? name : 'Guest'
}

function sameLobby(current: LobbyDTO, next: LobbyDTO): boolean {
  if (
    current.code !== next.code ||
    current.status !== next.status ||
    current.difficulty !== next.difficulty ||
    current.roundsTotal !== next.roundsTotal ||
    current.youAreHost !== next.youAreHost ||
    current.members.length !== next.members.length
  ) {
    return false
  }
  return current.members.every((member, index) => {
    const candidate = next.members[index]
    return (
      candidate !== undefined &&
      member.displayName === candidate.displayName &&
      member.isHost === candidate.isHost &&
      member.joinedAt === candidate.joinedAt
    )
  })
}

interface LobbySession {
  code: string
  token: string
}

export function LobbyPage() {
  const { code: routeCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()

  const [displayName, setDisplayName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [roundsTotal, setRoundsTotal] = useState(5)
  const [joinCode, setJoinCode] = useState((routeCode ?? '').toUpperCase())
  const [session, setSession] = useState<LobbySession | null>(null)
  const [lobby, setLobby] = useState<LobbyDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resumable, setResumable] = useState<LobbySession | null>(null)
  const [starting, setStarting] = useState(false)
  const leavingRef = useRef(false)
  const armedRef = useRef(false)
  const statusRef = useRef<LobbyDTO['status'] | null>(null)
  const cleanupState = useRef<{
    code: string | null
    token: string | null
    waiting: boolean
  }>({ code: null, token: null, waiting: false })

  // Errors and notices are transient: clear them after a few seconds.
  useEffect(() => {
    if (!error && !notice) return
    const timer = window.setTimeout(() => {
      setError(null)
      setNotice(null)
    }, FEEDBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [error, notice])

  // Prefill from the account without an effect: the user may still be loading.
  const effectiveName =
    nameTouched || displayName.length > 0
      ? displayName
      : (user?.displayName ?? '')

  // Keep the in-memory session in sync with the URL: the hub has none, a room
  // URL resumes the token this browser stored for that code.
  useEffect(() => {
    if (!routeCode) {
      setSession(null)
      armedRef.current = false
      return
    }
    const code = routeCode.toUpperCase()
    setJoinCode(code)
    const token = lobbiesApi.getLobbyToken(code)
    setSession(token ? { code, token } : null)
  }, [routeCode])

  useEffect(() => {
    cleanupState.current = {
      code: session?.code ?? null,
      token: session?.token ?? null,
      waiting: Boolean(session && lobby?.status === 'waiting'),
    }
  }, [session, lobby?.status])

  useEffect(() => {
    if (!session) return
    if (location.pathname.startsWith(`/lobby/${session.code}`)) {
      armedRef.current = true
      return
    }
    if (!armedRef.current || lobby?.status !== 'waiting' || leavingRef.current)
      return
    leavingRef.current = true
    void lobbiesApi
      .leaveLobby(session.code, session.token)
      .catch(() => {})
      .finally(() => {
        lobbiesApi.clearLobbyToken(session.code)
        lobbiesApi.clearCurrentLobbyCode()
      })
  }, [location.pathname, session, lobby?.status])

  useEffect(() => {
    return () => {
      const state = cleanupState.current
      if (!state.code || !state.token || !state.waiting || leavingRef.current)
        return
      if (window.location.pathname.endsWith('/game')) return
      lobbiesApi.leaveLobbyBeacon(state.code, state.token)
      lobbiesApi.clearLobbyToken(state.code)
      lobbiesApi.clearCurrentLobbyCode()
    }
  }, [])

  useEffect(() => {
    if (routeCode) return
    const code = lobbiesApi.getCurrentLobbyCode()
    const token = code ? lobbiesApi.getLobbyToken(code) : null
    if (!code || !token) {
      setResumable(null)
      return
    }
    let cancelled = false
    lobbiesApi
      .getLobby(code, token)
      .then(() => {
        if (cancelled) return
        setResumable({ code, token })
      })
      .catch(() => {
        if (cancelled) return
        lobbiesApi.clearLobbyToken(code)
        lobbiesApi.clearCurrentLobbyCode()
        setResumable(null)
      })
    return () => {
      cancelled = true
    }
  }, [routeCode])

  // Poll while inside a lobby so joins/leaves appear without a websocket.
  useEffect(() => {
    if (!session || !routeCode) return

    let cancelled = false
    let timer: number | undefined

    const tick = async () => {
      try {
        const next = await lobbiesApi.getLobby(session.code, session.token)
        if (cancelled) return
        setLobby((current) =>
          current && sameLobby(current, next) ? current : next,
        )
        if (
          (next.status === 'finished' ||
            (next.status === 'playing' && statusRef.current === 'waiting')) &&
          location.pathname === `/lobby/${next.code}`
        ) {
          navigate(`/lobby/${next.code}/game`)
        }
        statusRef.current = next.status
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          lobbiesApi.clearLobbyToken(session.code)
          setSession(null)
          setLobby(null)
          setNotice('That lobby has closed.')
          navigate('/multiplayer', { replace: true })
          return
        }
        setError(mapApiError(cause))
      }
      if (!cancelled) {
        timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS)
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [session, routeCode, navigate, location.pathname])

  function normalizedName(): string | undefined {
    const trimmed = effectiveName.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  function enterLobby(result: { lobby: LobbyDTO; lobbyToken: string }) {
    lobbiesApi.setLobbyToken(result.lobby.code, result.lobbyToken)
    lobbiesApi.setCurrentLobbyCode(result.lobby.code)
    setLobby(result.lobby)
    setSession({ code: result.lobby.code, token: result.lobbyToken })
    statusRef.current = result.lobby.status
    navigate(`/lobby/${result.lobby.code}`, { replace: true })
  }

  async function handleCreate() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      enterLobby(
        await lobbiesApi.createLobby({
          difficulty,
          roundsTotal,
          displayName: normalizedName(),
        }),
      )
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!CODE_PATTERN.test(code)) {
      setError('Enter the 6-character lobby code.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      enterLobby(await lobbiesApi.joinLobby(code, normalizedName()))
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    if (!session) return
    leavingRef.current = true
    setBusy(true)
    setError(null)
    try {
      await lobbiesApi.leaveLobby(session.code, session.token)
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 404)) {
        setError(mapApiError(cause))
        setBusy(false)
        return
      }
    }
    lobbiesApi.clearLobbyToken(session.code)
    lobbiesApi.clearCurrentLobbyCode()
    setSession(null)
    setLobby(null)
    setNotice('You left the lobby.')
    navigate('/multiplayer', { replace: true })
    setBusy(false)
    leavingRef.current = false
  }

  async function handleStart() {
    if (!session || (lobby?.members.length ?? 0) < 2) return
    setStarting(true)
    setError(null)
    setNotice(null)
    try {
      const next = await lobbiesApi.startLobbyMatch(
        session.code,
        session.token,
      )
      setLobby(next.lobby)
      statusRef.current = next.lobby.status
      navigate(`/lobby/${session.code}/game`)
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setStarting(false)
    }
  }

  function handleResume() {
    if (!resumable) return
    setSession(resumable)
    navigate(`/lobby/${resumable.code}`)
  }

  async function handleCopy() {
    if (!lobby) return
    try {
      await navigator.clipboard.writeText(lobby.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the code — select it manually.')
    }
  }

  const feedback =
    error || notice ? (
      <p
        className={`tl-feedback${error ? ' tl-feedback-error' : ''}`}
        role={error ? 'alert' : 'status'}
      >
        {error ?? notice}
      </p>
    ) : null

  return (
    <div className="tl-page">
      <PageNavigation active="multiplayer" />
      <main className="tl-main">
        {session && routeCode ? (
          lobby ? (
            <LobbyRoom
              lobby={lobby}
              busy={busy}
              starting={starting}
              copied={copied}
              onCopy={handleCopy}
              onLeave={handleLeave}
              onStart={handleStart}
              onReturnToMatch={() =>
                navigate(`/lobby/${lobby.code}/game`)
              }
            />
          ) : (
            <p className="tl-loading" role="status">
              Joining lobby…
            </p>
          )
        ) : (
          <>
            <header className="tl-hero">
              <span className="tl-eyebrow">Play together</span>
              <h1>Multiplayer</h1>
              <p>
                Host a lobby or join friends with a 6-character code. Everyone
                shares the same difficulty and rounds.
              </p>
            </header>

            {resumable && (
              <section className="tl-resume" aria-label="Return to lobby">
                <span>
                  <strong>Your lobby {resumable.code} is still open</strong>
                  <small>Jump back into the waiting room.</small>
                </span>
                <button
                  type="button"
                  className="tl-secondary"
                  onClick={handleResume}
                >
                  Return to lobby
                </button>
              </section>
            )}

            <label className="tl-name">
              <span>Your display name</span>
              <input
                value={effectiveName}
                maxLength={40}
                placeholder="Guest explorer"
                onChange={(event) => {
                  setNameTouched(true)
                  setDisplayName(event.target.value)
                }}
              />
            </label>

            {feedback}

            <div className="tl-grid">
              <section className="tl-panel" aria-labelledby="tl-create-title">
                <div className="tl-panel-head">
                  <span className="tl-panel-icon" aria-hidden="true">
                    <HomeIcon name="crown" />
                  </span>
                  <div>
                    <h2 id="tl-create-title">Create a lobby</h2>
                    <p className="tl-panel-copy">
                      You become the host. Difficulty applies to everyone and
                      sets the round time, attempts and selection mode. Choose
                      how many rounds the match lasts.
                    </p>
                  </div>
                </div>

                <div
                  className="tl-difficulty"
                  role="radiogroup"
                  aria-label="Difficulty"
                >
                  {DIFFICULTIES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={difficulty === option.value}
                      className={`tl-difficulty-option${
                        difficulty === option.value
                          ? ' tl-difficulty-option-active'
                          : ''
                      }`}
                      onClick={() => setDifficulty(option.value)}
                    >
                      <span className="tl-difficulty-label">
                        {option.label}
                      </span>
                      <span className="tl-difficulty-detail">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="tl-rounds">
                  <span id="tl-rounds-label" className="tl-rounds-label">
                    Number of rounds
                  </span>
                  <div
                    className="tl-rounds-options"
                    role="radiogroup"
                    aria-labelledby="tl-rounds-label"
                  >
                    {ROUND_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={roundsTotal === option}
                        className={`tl-difficulty-option tl-rounds-option${
                          roundsTotal === option
                            ? ' tl-difficulty-option-active'
                            : ''
                        }`}
                        onClick={() => setRoundsTotal(option)}
                      >
                        <span className="tl-difficulty-label">{option}</span>
                        <span className="tl-difficulty-detail">rounds</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="tl-primary"
                  onClick={handleCreate}
                  disabled={busy}
                >
                  {busy ? 'Creating…' : 'Create lobby'}
                </button>
              </section>

              <section className="tl-panel" aria-labelledby="tl-join-title">
                <div className="tl-panel-head">
                  <span className="tl-panel-icon" aria-hidden="true">
                    <HomeIcon name="users" />
                  </span>
                  <div>
                    <h2 id="tl-join-title">Join a lobby</h2>
                    <p className="tl-panel-copy">
                      Ask the host for the code shown in their lobby, then enter
                      it here.
                    </p>
                  </div>
                </div>

                <label className="tl-name tl-name-join">
                  <span>Lobby code</span>
                  <input
                    value={joinCode}
                    maxLength={6}
                    placeholder="ABC234"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setJoinCode(
                        event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="tl-secondary"
                  onClick={handleJoin}
                  disabled={busy}
                >
                  {busy ? 'Joining…' : 'Join lobby'}
                </button>
              </section>
            </div>

            <p className="tl-alt">
              Looking for a quick one-location duel?{' '}
              <Link to="/duels">Play a duel</Link>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function LobbyRoom({
  lobby,
  busy,
  starting,
  copied,
  onCopy,
  onLeave,
  onStart,
  onReturnToMatch,
}: {
  lobby: LobbyDTO
  busy: boolean
  starting: boolean
  copied: boolean
  onCopy: () => void
  onLeave: () => void
  onStart: () => void
  onReturnToMatch: () => void
}) {
  const statusLabel =
    lobby.status === 'waiting'
      ? 'Waiting for players'
      : lobby.status === 'playing'
        ? 'In progress'
        : 'Finished'

  return (
    <div className="tl-room">
      <div className="tl-room-header">
        <div>
          <span className="tl-eyebrow">Lobby code</span>
          <div className="tl-code-row">
            <span className="tl-code">{lobby.code}</span>
            <button type="button" className="tl-copy" onClick={onCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <span className={`tl-status tl-status-${lobby.status}`}>
          {statusLabel}
        </span>
      </div>

      <dl className="tl-facts">
        <div>
          <dt>Difficulty</dt>
          <dd className="tl-capitalize">{lobby.difficulty}</dd>
        </div>
        <div>
          <dt>Round time</dt>
          <dd>{minutes(lobby.rules.timeLimitSeconds)}</dd>
        </div>
        <div>
          <dt>Attempts</dt>
          <dd>{lobby.rules.attemptsPerRound}</dd>
        </div>
        <div>
          <dt>Selection</dt>
          <dd>{lobby.rules.selectionMode === 'map' ? 'World map' : 'List'}</dd>
        </div>
        <div>
          <dt>Rounds</dt>
          <dd>{lobby.roundsTotal}</dd>
        </div>
      </dl>

      <section className="tl-members" aria-labelledby="tl-members-title">
        <div className="tl-members-head">
          <h2 id="tl-members-title">Players</h2>
          <span>{lobby.members.length}</span>
        </div>
        <ul>
          {lobby.members.map((member, index) => (
            <li
              key={`${member.joinedAt}-${index}`}
              className="tl-member"
            >
              <span className="tl-avatar" aria-hidden="true">
                {memberName(member.displayName).slice(0, 1).toUpperCase()}
              </span>
              <span className="tl-member-name">
                {memberName(member.displayName)}
              </span>
              {member.isHost && <span className="tl-host-badge">Host</span>}
            </li>
          ))}
        </ul>
      </section>

      {lobby.status === 'waiting' && lobby.youAreHost && (
        <>
          <button
            type="button"
            className="tl-primary"
            onClick={onStart}
            disabled={busy || starting || lobby.members.length < 2}
          >
            {starting ? 'Starting match…' : 'Start match'}
          </button>
          {lobby.members.length < 2 && (
            <p className="tl-room-hint" role="status">
              Invite at least one more player before starting the match.
            </p>
          )}
        </>
      )}
      {lobby.status === 'playing' && (
        <button
          type="button"
          className="tl-primary"
          onClick={onReturnToMatch}
        >
          Return to match
        </button>
      )}

      <p className="tl-room-note">
        {lobby.status === 'waiting'
          ? 'Share the code with friends. This page refreshes automatically every few seconds.'
          : lobby.status === 'playing'
            ? 'The match is underway. Return to the match to keep guessing.'
            : 'This match has finished.'}
      </p>

      <button
        type="button"
        className="tl-danger"
        onClick={onLeave}
        disabled={busy}
      >
        {busy
          ? 'Leaving…'
          : lobby.youAreHost && lobby.status === 'waiting'
            ? 'Disband lobby'
            : 'Leave lobby'}
      </button>
    </div>
  )
}
