import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Lobby } from '../../lib/contracts'
import { api } from '../../services'
import { useLobbySession, clearLobbySession } from '../../state/lobby'
import { Button, IconButton } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Button'
import { hueFromString, initials } from '../../lib/format'
import { difficultyInfo } from '../../lib/difficulty'
import { staggerContainer, staggerItem } from '../../lib/motion'

export function LobbyPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const session = useLobbySession()

  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!session || session.code !== code.toUpperCase()) return
    try {
      const data = await api.lobby.get(code, session.token)
      setLobby(data)
      setError(null)
    } catch {
      setError('Lost connection to the lobby.')
    }
  }, [session, code])

  useEffect(() => {
    if (!session || session.code !== code.toUpperCase()) {
      navigate('/multiplayer', { replace: true })
      return
    }
    void load()
    const interval = window.setInterval(() => void load(), 1500)
    return () => window.clearInterval(interval)
  }, [session, code, load, navigate])

  async function start() {
    if (!session || !lobby) return
    setStarting(true)
    try {
      await api.lobby.start(code, session.token)
      navigate(`/lobby/${code}/play`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the match.')
      setStarting(false)
    }
  }

  async function leave() {
    if (session) {
      try {
        await api.lobby.leave(session.code, session.token)
      } catch {
        /* best-effort */
      }
    }
    clearLobbySession()
    navigate('/multiplayer')
  }

  if (!session || session.code !== code.toUpperCase()) return null
  if (!lobby) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
        <Spinner className="size-8 text-lime-300" />
        <p className="text-muted">Joining the lobby…</p>
      </div>
    )
  }

  const info = difficultyInfo(lobby.difficulty)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-5">
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow">Waiting room</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream">Gather your crew</h1>
          <p className="mt-1 text-muted">Share the code below and start when everyone's ready.</p>
        </motion.div>

        {/* Code */}
        <motion.div variants={staggerItem} className="surface flex flex-col items-center gap-2 p-6">
          <span className="text-sm font-bold uppercase tracking-wider text-subtle">Lobby code</span>
          <div className="flex items-center gap-3">
            <span className="font-display text-5xl font-semibold tracking-[0.25em] text-lime-300">{lobby.code}</span>
            <IconButton
              name={copied ? 'check' : 'copy'}
              label="Copy lobby code"
              onClick={() => {
                void navigator.clipboard.writeText(lobby.code)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            />
          </div>
          <span className="text-sm text-subtle">{info.label} · {lobby.roundsTotal} rounds</span>
        </motion.div>

        {/* Players */}
        <motion.div variants={staggerItem} className="surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-cream">Players</h2>
            <span className="rounded-full bg-space-800 px-3 py-1 text-xs font-bold text-muted">
              {lobby.members.length} joined
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lobby.members.map((member, index) => {
              const isHost = member.isHost
              const isYou = member.displayName === 'You'
              const hue = hueFromString(member.displayName ?? '?')
              return (
                <motion.div
                  key={`${member.displayName}-${index}`}
                  variants={staggerItem}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
                    isYou ? 'border-lime-400/40 bg-lime-400/8' : 'border-white/8 bg-space-800'
                  }`}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold text-ink"
                    style={{ background: `hsl(${hue} 70% 72%)` }}
                  >
                    {initials(member.displayName ?? '?')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-bold text-cream">
                      {member.displayName ?? 'Player'}
                      {isHost && <Icon name="crown" size={14} className="text-amber-300" />}
                    </span>
                    <span className="block text-xs text-subtle">{isYou ? 'You' : isHost ? 'Host' : 'Explorer'}</span>
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Rules */}
        <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {info.detail.map((detail) => (
            <span key={detail} className="rounded-full bg-space-700 px-3 py-1.5 font-bold text-muted">
              {detail}
            </span>
          ))}
        </motion.div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}

        <motion.div variants={staggerItem} className="flex flex-col gap-2 sm:flex-row">
          {lobby.youAreHost ? (
            <Button size="lg" icon="play" fullWidth loading={starting} onClick={start} disabled={lobby.members.length < 2}>
              {lobby.members.length < 2 ? 'Waiting for players…' : 'Start match'}
            </Button>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-space-700 py-4 text-muted">
              <Spinner className="size-5" />
              Waiting for the host to start…
            </div>
          )}
          <Button size="lg" variant="secondary" icon="exit" onClick={leave}>
            Leave
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
