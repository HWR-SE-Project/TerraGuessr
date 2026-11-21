import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { DifficultyPicker } from '../../components/game/DifficultyPicker'
import { Icon } from '../../components/ui/Icon'
import { api } from '../../services'
import { setGameCredentials } from '../../state/game'
import { difficultyInfo, readStoredDifficulty, storeDifficulty } from '../../lib/difficulty'
import type { Difficulty } from '../../lib/contracts'
import { staggerContainer, staggerItem } from '../../lib/motion'

export function SingleplayerPage() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<Difficulty>(readStoredDifficulty())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = difficultyInfo(difficulty)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      storeDifficulty(difficulty)
      const credentials = await api.singleplayer.create(difficulty)
      setGameCredentials(credentials)
      navigate('/singleplayer/play')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the game.')
      setLoading(false)
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
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </motion.div>

        <motion.div variants={staggerItem} className="mt-6 flex items-center gap-3 rounded-2xl bg-space-700 p-4">
          <Icon name="info" size={20} className="shrink-0 text-sky-300" />
          <p className="text-sm text-muted">
            {info.description}
          </p>
        </motion.div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-400/12 px-4 py-3 text-sm font-semibold text-rose-300">
            {error}
          </p>
        )}

        <motion.div variants={staggerItem} className="mt-8 flex justify-center">
          <Button size="lg" icon="play" loading={loading} onClick={start} className="min-w-56">
            Start exploring
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
