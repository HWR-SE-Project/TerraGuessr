import { useCurrentLobby } from '../../game/useCurrentLobby'
import { DifficultyPicker } from '../../game/DifficultyPicker'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Icon } from '../../components/ui/Icon'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import * as lobbiesApi from '../../api/lobbies'
import { ApiError } from '../../api/client'
import { mapApiError } from '../../api/errorMessages'
import { AppHeader } from '../../components/layout/AppHeader'
import { useSession } from '../../state/SessionContext'
import type { Difficulty, LobbyDTO } from '../../api/types'
import {
  duration,
  ease,
  noticeVariants,
  spring,
  staggerContainer,
  staggerItem,
} from '../../lib/motion'
import './LobbyPage.css'

/** Player rows join with the shared stagger entrance and leave with a quick slide-out. */
const memberRowVariants = {
  initial: staggerItem.initial,
  animate: staggerItem.animate,
  exit: { opacity: 0, x: -16, transition: { duration: duration.fast, ease: ease.out } },
}

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

export function LobbyPage({ mode = 'create' }: { mode?: 'create' | 'join' }) {
  const { code: routeCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const { user } = useSession()

  // The nav dropdown and invitation links pick the mode; there is no in-page
  // landing choice anymore, so this is derived rather than toggled.
  const entryMode = routeCode ? 'join' : mode
  const [codeInvalid, setCodeInvalid] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [roundsTotal, setRoundsTotal] = useState(5)
  const [joinCode, setJoinCode] = useState((routeCode ?? '').toUpperCase())
  const session = useMemo<LobbySession | null>(() => {
    const code = routeCode?.toUpperCase()
    const token = code ? lobbiesApi.getLobbyToken(code) : null
    return code && token ? { code, token } : null
  }, [routeCode])
  const [lobby, setLobby] = useState<LobbyDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resumable = useCurrentLobby(!routeCode)
  const [starting, setStarting] = useState(false)
  const leavingRef = useRef(false)
  const statusRef = useRef<LobbyDTO['status'] | null>(null)
  // Notices are transient; errors remain available until the player retries.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      setNotice(null)
    }, FEEDBACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Prefill from the account without an effect: the user may still be loading.
  const effectiveName =
    nameTouched || displayName.length > 0
      ? displayName
      : (user?.displayName ?? '')

  // The URL and stored membership own the room identity. Leaving a waiting
  // room cleans up once; moving into its match keeps the membership intact.
  useEffect(() => {
    if (!session) return
    return () => {
      if (statusRef.current !== 'waiting' || leavingRef.current) return
      if (window.location.pathname === `/lobby/${session.code}/game`) return
      lobbiesApi.leaveLobbyBeacon(session.code, session.token)
      lobbiesApi.forgetLobby(session.code)
    }
  }, [session])

  // Poll while inside a lobby so joins/leaves appear without a websocket.
  useEffect(() => {
    if (!session) return

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
            (next.status === 'playing' && statusRef.current === 'waiting'))
        ) {
          navigate(`/lobby/${next.code}/game`)
        }
        statusRef.current = next.status
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          lobbiesApi.clearLobbyToken(session.code)
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
  }, [session, navigate])

  function applyJoinCode(raw: string) {
    setJoinCode(raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
    setCodeInvalid(false)
    setError(null)
  }

  function normalizedName(): string | undefined {
    const trimmed = effectiveName.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  function enterLobby(result: { lobby: LobbyDTO; lobbyToken: string }) {
    lobbiesApi.setLobbyToken(result.lobby.code, result.lobbyToken)
    lobbiesApi.setCurrentLobbyCode(result.lobby.code)
    setLobby(result.lobby)
    statusRef.current = result.lobby.status
    navigate(`/lobby/${result.lobby.code}`, { replace: true })
  }

  async function withFeedback(setBusyFlag: (busy: boolean) => void, action: () => Promise<void>) {
    setBusyFlag(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setBusyFlag(false)
    }
  }

  async function handleCreate() {
    await withFeedback(setBusy, async () => {
      enterLobby(
        await lobbiesApi.createLobby({
          difficulty,
          roundsTotal,
          displayName: normalizedName(),
        }),
      )
    })
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!CODE_PATTERN.test(code)) {
      setCodeInvalid(true)
      codeInputRef.current?.focus()
      return
    }
    await withFeedback(setBusy, async () => {
      enterLobby(await lobbiesApi.joinLobby(code, normalizedName()))
    })
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
        leavingRef.current = false
        return
      }
    }
    lobbiesApi.forgetLobby(session.code)
    setLobby(null)
    setNotice('You left the lobby.')
    navigate('/multiplayer', { replace: true })
    setBusy(false)
    leavingRef.current = false
  }

  async function handleStart() {
    if (!session || (lobby?.members.length ?? 0) < 2) return
    await withFeedback(setStarting, async () => {
      const next = await lobbiesApi.startLobbyMatch(session.code, session.token)
      setLobby(next.lobby)
      statusRef.current = next.lobby.status
      navigate(`/lobby/${session.code}/game`)
    })
  }

  function handleResume() {
    if (!resumable) return
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

  const feedback = (
    <AnimatePresence>
      {(error || notice) && (
        <motion.p
          key={error ? 'error' : 'notice'}
          className={`tl-feedback${error ? ' tl-feedback-error' : ''}`}
          role={error ? 'alert' : 'status'}
          variants={noticeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {error ?? notice}
        </motion.p>
      )}
    </AnimatePresence>
  )

  return (
    <div className="tl-page">
      <AppHeader />
      <main className={`tl-main${session && routeCode ? '' : ` tl-entry${entryMode === 'create' ? ' tl-entry--create' : ''}`}`}>
        {session && routeCode && feedback}
        {session && routeCode ? (
          lobby?.code === session.code ? (
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
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <motion.header className="tl-hero" variants={staggerItem}>
              {entryMode === 'create' && <span className="tl-hero-icon" aria-hidden="true"><Icon name="users" /></span>}
              <h1>{entryMode === 'create' ? 'Create a lobby' : 'Join a lobby'}</h1>
              <p>
                {entryMode === 'create'
                  ? 'Your friends. A whole world. Set up your next adventure.'
                  : 'Enter an existing lobby using a code.'}
              </p>
            </motion.header>

            <AnimatePresence>
              {resumable && (
                <motion.section
                  key="resume"
                  className="tl-resume"
                  aria-label="Return to lobby"
                  variants={noticeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <span>
                    <strong>Your lobby {resumable.code} is still open</strong>
                    <small>Jump back into the waiting room.</small>
                  </span>
                  <Button appearance="flat" variant="secondary" type="button" onClick={handleResume}>
                    Return to lobby
                  </Button>
                </motion.section>
              )}
            </AnimatePresence>

            <motion.form
              variants={staggerItem}
              className={`tl-entry-form${entryMode === 'create' ? ' tl-create-form' : ' tg-glass tg-glass--panel'}`}
              aria-label={entryMode === 'create' ? 'Create a lobby' : 'Join a lobby'}
              aria-busy={busy}
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                if (busy) return
                void (entryMode === 'create' ? handleCreate() : handleJoin())
              }}
            >
              <div className="tl-entry-config">
              {entryMode === 'create' && <div className="tl-section-heading"><h2>Make it your game</h2><p>Choose how you want to explore.</p></div>}
              {entryMode === 'create' ? (
                <DifficultyPicker variant="lobby" value={difficulty} onChange={setDifficulty} disabled={busy} />
              ) : (
                <label className="tl-name tl-name-join">
                  <span>Lobby code</span>
                  <Input
                    ref={codeInputRef}
                    name="lobbyCode"
                    value={joinCode}
                    maxLength={6}
                    placeholder="ABC234"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    enterKeyHint="go"
                    aria-invalid={codeInvalid || undefined}
                    aria-describedby="tl-code-hint"
                    disabled={busy}
                    onChange={(event) => applyJoinCode(event.target.value)}
                    onPaste={(event) => {
                      event.preventDefault()
                      applyJoinCode(event.clipboardData.getData('text'))
                    }}
                  />
                  <span id="tl-code-hint" className={codeInvalid ? 'tl-field-error' : 'tl-field-hint'} role={codeInvalid ? 'alert' : undefined}>
                    {codeInvalid ? 'Enter all 6 letters or numbers to join.' : '6 letters or numbers, shared by your host.'}
                  </span>
                </label>
              )}

              {entryMode === 'create' && <div className="tl-section-heading tl-section-heading--details"><h2>The finishing touches</h2><p>A name for you. A length for your adventure.</p></div>}
              <div className={`tl-entry-fields${entryMode === 'create' ? ' tl-entry-fields-create' : ''}`}>
                <label className="tl-name">
                  <span>Display name <span className="tl-optional">optional</span></span>
                  <Input
                    name="displayName"
                    autoComplete="nickname"
                    value={effectiveName}
                    maxLength={40}
                    placeholder="Guest explorer"
                    disabled={busy}
                    onChange={(event) => {
                      setNameTouched(true)
                      setDisplayName(event.target.value)
                    }}
                  />
                </label>
                {entryMode === 'create' && (
                  <label className="tl-name tl-rounds">
                    <span>Number of rounds</span>
                    <select className="tg-field" name="rounds" value={roundsTotal} disabled={busy} onChange={(event) => setRoundsTotal(Number(event.target.value))}>
                      {ROUND_OPTIONS.map((rounds) => <option key={rounds} value={rounds}>{rounds} rounds</option>)}
                    </select>
                  </label>
                )}
              </div>

              {feedback}
              </div>
              <div className="tl-entry-footer">
                <span>{entryMode === 'create' ? 'Your invite code is ready on the next screen.' : ''}</span>
                <Button appearance="flat" type="submit" disabled={busy}>
                  {entryMode === 'create' ? (busy ? 'Creating…' : 'Create lobby') : (busy ? 'Joining…' : 'Join lobby')}
                  {!busy && <Icon name="arrow" />}
                </Button>
              </div>
            </motion.form>

            {!routeCode && (
              <p className="tl-switch-mode">
                {entryMode === 'create' ? (
                  <>
                    Looking to join a friend instead?{' '}
                    <Link to="/multiplayer/join">Join a lobby</Link>
                  </>
                ) : (
                  <>
                    Want to host your own game?{' '}
                    <Link to="/multiplayer/create">Create a lobby</Link>
                  </>
                )}
              </p>
            )}
          </motion.div>
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
    <motion.div
      className="tl-room"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div className="tl-room-header" variants={staggerItem}>
        <div>
          <span className="tl-eyebrow">Lobby code</span>
          <div className="tl-code-row">
            <span className="tl-code">{lobby.code}</span>
            <Button appearance="flat" variant="secondary" size="sm" type="button" onClick={onCopy}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: duration.fast, ease: ease.out }}
                  style={{ display: 'inline-block' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </motion.span>
              </AnimatePresence>
            </Button>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={lobby.status}
            className={`tl-status tl-status-${lobby.status}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={spring.snappy}
          >
            {statusLabel}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      <motion.dl className="tl-facts" variants={staggerItem}>
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
      </motion.dl>

      <motion.section className="tl-members" aria-labelledby="tl-members-title" variants={staggerItem}>
        <div className="tl-members-head">
          <h2 id="tl-members-title">Players</h2>
          <span>{lobby.members.length}</span>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {lobby.members.map((member) => (
              <motion.li
                key={`${member.joinedAt}-${member.displayName ?? ''}`}
                className="tl-member"
                layout
                variants={memberRowVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <span className="tl-avatar" aria-hidden="true">
                  {memberName(member.displayName).slice(0, 1).toUpperCase()}
                </span>
                <span className="tl-member-name">
                  {memberName(member.displayName)}
                </span>
                {member.isHost && <span className="tl-host-badge">Host</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.section>

      {lobby.status === 'waiting' && lobby.youAreHost && (
        <motion.div variants={staggerItem}>
          <Button appearance="flat" block
            type="button"
            className="tl-room-start"
            onClick={onStart}
            disabled={busy || starting || lobby.members.length < 2}
          >
            {starting ? 'Starting match…' : 'Start match'}
          </Button>
          {lobby.members.length < 2 && (
            <p className="tl-room-hint" role="status">
              Invite at least one more player before starting the match.
            </p>
          )}
        </motion.div>
      )}
      {lobby.status === 'playing' && (
        <motion.div variants={staggerItem}>
          <Button appearance="flat" block
            type="button"
            className="tl-room-start"
            onClick={onReturnToMatch}
          >
            Return to match
          </Button>
        </motion.div>
      )}

      <motion.p className="tl-room-note" variants={staggerItem}>
        {lobby.status === 'waiting'
          ? 'Share the code with friends. This page refreshes automatically every few seconds.'
          : lobby.status === 'playing'
            ? 'The match is underway. Return to the match to keep guessing.'
            : 'This match has finished.'}
      </motion.p>

      <motion.div variants={staggerItem}>
        <Button appearance="flat" variant="danger" block
          type="button"
          onClick={onLeave}
          disabled={busy}
        >
          {busy
            ? 'Leaving…'
            : lobby.youAreHost && lobby.status === 'waiting'
              ? 'Disband lobby'
              : 'Leave lobby'}
        </Button>
      </motion.div>
    </motion.div>
  )
}
