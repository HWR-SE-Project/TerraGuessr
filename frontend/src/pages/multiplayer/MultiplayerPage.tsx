import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { DifficultyPicker, DifficultySummary } from '../../components/game/DifficultyPicker'
import { Icon } from '../../components/ui/Icon'
import { api } from '../../services'
import { setLobbySession } from '../../state/lobby'
import { useSession } from '../../state/session'
import { readStoredDifficulty, storeDifficulty } from '../../lib/difficulty'
import { readOrCreateGuestName, storeGuestName } from '../../lib/playerName'
import { useGameRules } from '../../state/gameRules'
import type { Difficulty, LobbySession } from '../../lib/contracts'
import { fadeUp, staggerContainer, staggerItem } from '../../lib/motion'

type Mode = 'create' | 'join'

export function MultiplayerPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialMode: Mode = params.get('mode') === 'join' ? 'join' : 'create'
  const [mode, setMode] = useState<Mode>(initialMode)
  const { status, user } = useSession()
  const [guestName] = useState(() => readOrCreateGuestName())
  const [customName, setCustomName] = useState<string | null>(null)

  const defaultName = status === 'authed' && user?.displayName
    ? user.displayName
    : status === 'guest'
      ? guestName
      : ''
  const displayName = customName ?? defaultName

  function handleDisplayNameSubmit(submittedName?: string) {
    if (status === 'guest' && submittedName) storeGuestName(submittedName)
  }

  function enterLobby({ lobby, lobbyToken }: LobbySession) {
    setLobbySession({ code: lobby.code, token: lobbyToken, isHost: lobby.youAreHost })
    navigate(`/lobby/${lobby.code}`)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow !text-muted">Multiplayer</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-cream sm:text-3xl">Play with friends</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Host a lobby and share the code, or hop into a friend's game.
          </p>
        </motion.div>

        <motion.div variants={staggerItem} className="mx-auto mt-4 flex max-w-xs rounded-2xl bg-space-700 p-1">
          {(['create', 'join'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                mode === m ? 'bg-lime-400 text-ink' : 'text-muted hover:text-cream'
              }`}
            >
              {m === 'create' ? 'Create' : 'Join'}
            </button>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-4">
          {mode === 'create' ? (
            <CreateLobby
              displayName={displayName}
              onDisplayNameChange={setCustomName}
              onDisplayNameSubmit={handleDisplayNameSubmit}
              onEntered={enterLobby}
            />
          ) : (
            <JoinLobby
              displayName={displayName}
              onDisplayNameChange={setCustomName}
              onDisplayNameSubmit={handleDisplayNameSubmit}
              onEntered={enterLobby}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

function CreateLobby({
  displayName,
  onDisplayNameChange,
  onDisplayNameSubmit,
  onEntered,
}: {
  displayName: string
  onDisplayNameChange: (value: string) => void
  onDisplayNameSubmit: (submittedName?: string) => void
  onEntered: (session: LobbySession) => void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>(readStoredDifficulty())
  const [rounds, setRounds] = useState(5)
  const rules = useGameRules()

  async function create(submittedName?: string) {
    const session = await api.lobby.create({ difficulty, roundsTotal: rounds, displayName: submittedName })
    storeDifficulty(difficulty)
    return session
  }

  return (
    <LobbyEntryForm
      displayName={displayName}
      onDisplayNameChange={onDisplayNameChange}
      onDisplayNameSubmit={onDisplayNameSubmit}
      action={create}
      onEntered={onEntered}
      label="Create lobby"
      icon="plus"
      errorMessage="Could not create the lobby."
    >
      <div>
        <span className="text-sm font-bold text-cream/90">Difficulty</span>
        <div className="mt-2">
          <DifficultyPicker value={difficulty} onChange={setDifficulty} rules={rules?.difficulties} />
        </div>
      </div>

      <Field label="Rounds" htmlFor="mp-rounds">
        <div className="flex items-center gap-3">
          <StepButton onClick={() => setRounds((r) => Math.max(3, r - 1))} label="Fewer rounds" icon="minus" />
          <span className="font-display text-2xl font-semibold text-cream">{rounds}</span>
          <StepButton onClick={() => setRounds((r) => Math.min(10, r + 1))} label="More rounds" icon="plus" />
        </div>
      </Field>

      <DifficultySummary difficulty={difficulty} rules={rules?.difficulties[difficulty]} className="bg-space-800" />

    </LobbyEntryForm>
  )
}

function JoinLobby({
  displayName,
  onDisplayNameChange,
  onDisplayNameSubmit,
  onEntered,
}: {
  displayName: string
  onDisplayNameChange: (value: string) => void
  onDisplayNameSubmit: (submittedName?: string) => void
  onEntered: (session: LobbySession) => void
}) {
  const [code, setCode] = useState('')

  return (
    <LobbyEntryForm
      displayName={displayName}
      onDisplayNameChange={onDisplayNameChange}
      onDisplayNameSubmit={onDisplayNameSubmit}
      action={(submittedName) => api.lobby.join(code, submittedName)}
      onEntered={onEntered}
      label="Join lobby"
      icon="users"
      errorMessage="Could not join that lobby."
      disabled={code.length !== 6}
    >
      <Field label="Lobby code" htmlFor="join-code" hint="Six characters, e.g. AB3C9X.">
        <Input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="AB3C9X"
          maxLength={6}
          icon="search"
          className="font-display text-xl tracking-[0.3em]"
        />
      </Field>
    </LobbyEntryForm>
  )
}

function LobbyEntryForm({
  displayName,
  onDisplayNameChange,
  onDisplayNameSubmit,
  action,
  onEntered,
  label,
  icon,
  errorMessage,
  disabled = false,
  children,
}: {
  displayName: string
  onDisplayNameChange: (value: string) => void
  onDisplayNameSubmit: (submittedName?: string) => void
  action: (displayName?: string) => Promise<LobbySession>
  onEntered: (session: LobbySession) => void
  label: string
  icon: 'plus' | 'users'
  errorMessage: string
  disabled?: boolean
  children: ReactNode
}) {
  const nameId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled || pending.current) return
    pending.current = true
    setLoading(true)
    setError(null)
    try {
      const submittedName = displayName.trim() || undefined
      onDisplayNameSubmit(submittedName)
      const session = await action(submittedName)
      if (mounted.current) onEntered(session)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : errorMessage)
    } finally {
      pending.current = false
      if (mounted.current) setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="surface flex flex-col gap-3 p-5">
      <Field label="Your name" htmlFor={nameId}>
        <Input id={nameId} value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="e.g. Wandering Nix" maxLength={40} icon="person" />
      </Field>
      {children}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">{error}</p>
      )}
      <Button type="submit" size="lg" icon={icon} loading={loading} disabled={disabled}>{label}</Button>
    </form>
  )
}

function StepButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: 'plus' | 'minus' }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-space-600 text-cream transition-colors hover:bg-space-500"
    >
      <Icon name={icon} size={20} />
    </button>
  )
}
