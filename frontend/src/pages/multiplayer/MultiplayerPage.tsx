import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { DifficultyPicker } from '../../components/game/DifficultyPicker'
import { Icon } from '../../components/ui/Icon'
import { api } from '../../services'
import { setLobbySession } from '../../state/lobby'
import { difficultyInfo, readStoredDifficulty } from '../../lib/difficulty'
import type { Difficulty } from '../../lib/contracts'
import { fadeUp, staggerContainer, staggerItem } from '../../lib/motion'

type Mode = 'create' | 'join'

export function MultiplayerPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialMode: Mode = params.get('mode') === 'join' ? 'join' : 'create'
  const [mode, setMode] = useState<Mode>(initialMode)

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col justify-center overflow-hidden px-4 py-4 sm:px-6">
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
          {mode === 'create' ? <CreateLobby navigate={navigate} /> : <JoinLobby navigate={navigate} />}
        </motion.div>
      </motion.div>
    </div>
  )
}

function CreateLobby({ navigate }: { navigate: (to: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(readStoredDifficulty())
  const [rounds, setRounds] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = difficultyInfo(difficulty)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const session = await api.lobby.create({ difficulty, roundsTotal: rounds, displayName: displayName || undefined })
      setLobbySession({ code: session.lobby.code, token: session.lobbyToken, isHost: session.lobby.youAreHost })
      navigate(`/lobby/${session.lobby.code}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the lobby.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={create} className="surface flex flex-col gap-3 p-5">
      <Field label="Your name" htmlFor="mp-name">
        <Input id="mp-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Wandering Nix" maxLength={40} icon="person" />
      </Field>

      <div>
        <span className="text-sm font-bold text-cream/90">Difficulty</span>
        <div className="mt-2">
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </div>
      </div>

      <Field label="Rounds" htmlFor="mp-rounds">
        <div className="flex items-center gap-3">
          <StepButton onClick={() => setRounds((r) => Math.max(3, r - 1))} label="Fewer rounds" icon="minus" />
          <span className="font-display text-2xl font-semibold text-cream">{rounds}</span>
          <StepButton onClick={() => setRounds((r) => Math.min(10, r + 1))} label="More rounds" icon="plus" />
        </div>
      </Field>

      <div className="rounded-2xl bg-space-800 px-4 py-2.5 text-sm text-muted">
        <Icon name="info" size={16} className="mr-1.5 inline text-sky-300" />
        {info.label}: {info.detail.join(' · ')}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" icon="plus" loading={loading}>
        Create lobby
      </Button>
    </form>
  )
}

function JoinLobby({ navigate }: { navigate: (to: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const session = await api.lobby.join(code, displayName || undefined)
      setLobbySession({ code: session.lobby.code, token: session.lobbyToken, isHost: session.lobby.youAreHost })
      navigate(`/lobby/${session.lobby.code}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join that lobby.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={join} className="surface flex flex-col gap-3 p-5">
      <Field label="Your name" htmlFor="join-name">
        <Input id="join-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Wandering Nix" maxLength={40} icon="person" />
      </Field>
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
      {error && (
        <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" icon="users" loading={loading} disabled={code.length !== 6}>
        Join lobby
      </Button>
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
