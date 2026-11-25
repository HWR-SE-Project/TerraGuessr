import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../services'
import { useLobbyPolling, useLobbyRoute } from './useLobbyRoute'
import { Button, IconButton, Spinner } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { PlayerBadge } from '../../components/game/PlayerBadge'
import { difficultyDetails, difficultyInfo } from '../../lib/difficulty'
import { staggerContainer, staggerItem } from '../../lib/motion'

export function LobbyPage() {
  const { session, leave, leaving, openMatch } = useLobbyRoute()
  const { data: lobby, error: connectionError } = useLobbyPolling(session, api.lobby.get, 1500, !leaving)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const error = startError ?? (connectionError ? 'Lost connection to the lobby.' : null)

  useEffect(() => {
    if (lobby?.status === 'playing') openMatch()
  }, [lobby?.status, openMatch])

  async function start() {
    if (!session || !lobby) return
    setStarting(true)
    setStartError(null)
    try {
      await api.lobby.start(session.code, session.token)
      openMatch()
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : 'Could not start the match.')
    } finally {
      setStarting(false)
    }
  }

  if (!session) return null
  if (!lobby) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
        {error ? <p role="alert" className="text-muted">{error}</p> : (
          <>
            <Spinner className="size-8 text-lime-300" />
            <p className="text-muted">Joining the lobby…</p>
          </>
        )}
        <Button variant="secondary" onClick={leave} loading={leaving}>Leave</Button>
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
              const isYou = Boolean(member.isYou)
              return (
                <motion.div
                  key={`${member.displayName}-${index}`}
                  variants={staggerItem}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
                    isYou ? 'border-lime-400/40 bg-lime-400/8' : 'border-white/8 bg-space-800'
                  }`}
                >
                  <PlayerBadge name={member.displayName} />
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
          {difficultyDetails(lobby.rules).map((detail) => (
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
            <Button size="lg" icon="play" fullWidth loading={starting} onClick={start} disabled={leaving || lobby.members.length < 2}>
              {lobby.members.length < 2 ? 'Waiting for players…' : 'Start match'}
            </Button>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-space-700 py-4 text-muted">
              <Spinner className="size-5" />
              Waiting for the host to start…
            </div>
          )}
          <Button size="lg" variant="secondary" icon="exit" onClick={leave} loading={leaving}>
            Leave
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
