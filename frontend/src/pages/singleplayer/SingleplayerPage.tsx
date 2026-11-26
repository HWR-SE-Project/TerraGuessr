import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { DifficultyPicker, DifficultySummary } from '../../components/game/DifficultyPicker'
import { RoundCountStepper } from '../../components/game/RoundCountStepper'
import { api, ApiError } from '../../services'
import { setGameCredentials } from '../../state/game'
import { useGameRules } from '../../state/gameRules'
import { warmSingleplayer } from '../../state/singleplayerWarmup'
import { readStoredDifficulty, storeDifficulty } from '../../lib/difficulty'
import {
  clampRounds,
  DEFAULT_ROUNDS_TOTAL,
  readStoredSingleplayerRounds,
  resolveRoundBounds,
  storeSingleplayerRounds,
} from '../../lib/rounds'
import type { Difficulty } from '../../lib/contracts'
import { staggerContainer, staggerItem } from '../../lib/motion'

type RoundMode = 'fixed' | 'endless'

const WAKEUP_HINT_DELAY_MS = 3_000
const COLD_START_MAX_RETRIES = 2
const COLD_START_RETRY_DELAY_MS = 2_000

function isColdStartGatewayError(cause: unknown): boolean {
  if (!(cause instanceof ApiError)) return false
  return cause.status === 0 || cause.status === 502 || cause.status === 504
}

export function SingleplayerPage() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<Difficulty>(readStoredDifficulty())
  const [initialRounds] = useState(() => readStoredSingleplayerRounds())
  const [roundMode, setRoundMode] = useState<RoundMode>(() => (initialRounds === null ? 'endless' : 'fixed'))
  const [rounds, setRounds] = useState<number>(() => initialRounds ?? DEFAULT_ROUNDS_TOTAL)
  const [loading, setLoading] = useState(false)
  const [slowWakeup, setSlowWakeup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rules = useGameRules()
  const roundBounds = resolveRoundBounds(rules?.rounds)
  const selectedRounds = clampRounds(rounds, roundBounds)

  useEffect(() => {
    warmSingleplayer()
  }, [])

  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => setSlowWakeup(true), WAKEUP_HINT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loading])

  async function start() {
    setLoading(true)
    setSlowWakeup(false)
    setError(null)
    try {
      const roundsTotal = roundMode === 'endless' ? null : selectedRounds
      storeDifficulty(difficulty)
      storeSingleplayerRounds(roundsTotal)
      let created
      for (let attempt = 0; ; attempt += 1) {
        try {
          created = await api.singleplayer.create(difficulty, roundsTotal)
          break
        } catch (cause) {
          if (attempt < COLD_START_MAX_RETRIES && isColdStartGatewayError(cause)) {
            setSlowWakeup(true)
            await new Promise((resolve) => window.setTimeout(resolve, COLD_START_RETRY_DELAY_MS))
            continue
          }
          throw cause
        }
      }
      setGameCredentials(
        { id: created.id, playerToken: created.playerToken },
        created.session ?? null,
      )
      navigate('/singleplayer/play')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the game.')
      setLoading(false)
      setSlowWakeup(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow !text-muted">Singleplayer</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cream sm:text-4xl">
            Choose your challenge
          </h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            The harder the setting, the less time and fewer guesses you get.
          </p>
        </motion.div>

        <motion.div variants={staggerItem} className="mt-8">
          <DifficultyPicker value={difficulty} onChange={setDifficulty} rules={rules?.difficulties} disabled={loading} />
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="mt-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-space-700 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-2">
            <div>
              <span className="font-display text-lg font-semibold text-cream">Rounds</span>
              <p className="text-sm text-muted">
                {roundMode === 'fixed'
                  ? `Ends automatically after ${selectedRounds} rounds.`
                  : 'Keep exploring until you choose to end the session.'}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Round limit"
              className="inline-flex w-fit rounded-2xl bg-space-800 p-1"
            >
              {([
                { id: 'fixed', label: 'Set rounds' },
                { id: 'endless', label: 'Endless' },
              ] as const).map((option) => {
                const active = roundMode === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={loading}
                    onClick={() => setRoundMode(option.id)}
                    className={`rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${
                      active ? 'bg-lime-400 text-ink' : 'text-muted hover:text-cream'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center sm:justify-end">
            {roundMode === 'fixed' ? (
              <RoundCountStepper
                value={selectedRounds}
                min={roundBounds.min}
                max={roundBounds.max}
                onChange={setRounds}
                disabled={loading}
              />
            ) : (
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 text-lime-300">
                <Icon name="infinity" size={22} />
                <span className="font-display text-base font-semibold">Unlimited</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6">
          <DifficultySummary difficulty={difficulty} rules={rules?.difficulties[difficulty]} />
        </motion.div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-400/12 px-4 py-3 text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}

        <motion.div variants={staggerItem} className="mt-8 flex flex-col items-center gap-2">
          <Button size="lg" icon="play" loading={loading} onClick={start} className="min-w-56">
            Start exploring
          </Button>
          {loading && slowWakeup && (
            <p role="status" aria-live="polite" className="text-center text-sm text-muted">
              Waking up the server — first load may take a moment…
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
