import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

const POLL_INTERVAL_MS = 3000
const FEEDBACK_TIMEOUT_MS = 5000
const CODE_PATTERN = /^[A-Z0-9]{6}$/

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`
}

function memberName(name: string | null): string {
  return name && name.length > 0 ? name : 'Guest'
}

interface LobbySession {
  code: string
  token: string
}

export function LobbyPage() {
  const { code: routeCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const { user } = useSession()

  const [displayName, setDisplayName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [joinCode, setJoinCode] = useState((routeCode ?? '').toUpperCase())
  const [session, setSession] = useState<LobbySession | null>(null)
  const [lobby, setLobby] = useState<LobbyDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      return
    }
    const code = routeCode.toUpperCase()
    setJoinCode(code)
    const token = lobbiesApi.getLobbyToken(code)
    setSession(token ? { code, token } : null)
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
        setLobby(next)
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
  }, [session, routeCode, navigate])

  function normalizedName(): string | undefined {
    const trimmed = effectiveName.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  function enterLobby(result: { lobby: LobbyDTO; lobbyToken: string }) {
    lobbiesApi.setLobbyToken(result.lobby.code, result.lobbyToken)
    setLobby(result.lobby)
    setSession({ code: result.lobby.code, token: result.lobbyToken })
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
    setSession(null)
    setLobby(null)
    setNotice('You left the lobby.')
    navigate('/multiplayer', { replace: true })
    setBusy(false)
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
              copied={copied}
              onCopy={handleCopy}
              onLeave={handleLeave}
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
                      sets the round time, attempts and selection mode.
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
  copied,
  onCopy,
  onLeave,
}: {
  lobby: LobbyDTO
  busy: boolean
  copied: boolean
  onCopy: () => void
  onLeave: () => void
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
          <span>
            {lobby.members.length} / {lobby.maxPlayers}
          </span>
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

      <p className="tl-room-note">
        Share the code with friends. This page refreshes automatically every few
        seconds.
      </p>

      <button
        type="button"
        className="tl-danger"
        onClick={onLeave}
        disabled={busy}
      >
        {busy
          ? 'Leaving…'
          : lobby.youAreHost
            ? 'Disband lobby'
            : 'Leave lobby'}
      </button>
    </div>
  )
}
