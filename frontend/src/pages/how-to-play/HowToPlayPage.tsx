import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { Tutorial } from '../../components/tutorial/Tutorial'
import { DIFFICULTY_LEVELS, difficultyDetails } from '../../lib/difficulty'
import { formatScore } from '../../lib/format'
import { useGameRules } from '../../state/gameRules'

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'globe',
    title: 'You appear somewhere',
    text: 'Each round drops your explorer onto a live 3D biome diorama shaped by the destination’s environment and real-time weather.',
  },
  {
    icon: 'scan',
    title: 'Read the clues',
    text: 'Weather, terrain and elevation hint at the climate and region you’re in.',
  },
  {
    icon: 'pin',
    title: 'Make your guess',
    text: 'Easy mode picks from a city list. Medium and hard drop a pin on the world map.',
  },
  {
    icon: 'trophy',
    title: 'Earn points',
    text: 'Closer guesses earn more points.',
  },
]

export function HowToPlayPage() {
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const rules = useGameRules()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-8">
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow !text-muted">How to play</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-cream">Become a master explorer</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            A minute to learn, a lifetime to master. Here's everything you need.
          </p>
          <Button size="md" variant="tinted" icon="scan" className="mx-auto mt-4" onClick={() => setTutorialOpen(true)}>
            Start interactive tutorial
          </Button>
        </motion.div>

        <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <div key={step.title} className="surface flex items-start gap-4 p-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Icon name={step.icon} size={24} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-subtle">Step {index + 1}</p>
                <h2 className="mt-0.5 font-display text-lg font-semibold text-cream">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {rules && <motion.div variants={staggerItem}>
          <h2 className="mb-4 text-center font-display text-2xl font-semibold text-cream">Difficulty at a glance</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {DIFFICULTY_LEVELS.map((difficulty) => (
              <div key={difficulty.id} className="surface-flat p-5">
                <h3 className="font-display text-lg font-semibold text-lime-300">{difficulty.label}</h3>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {difficultyDetails(rules.difficulties[difficulty.id]).map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted">
                      <Icon name="check" size={14} className="text-lime-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>}

        {rules && <motion.div variants={staggerItem}>
          <h2 className="mb-4 text-center font-display text-2xl font-semibold text-cream">Scoring</h2>
          <div className="surface p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-display text-3xl font-semibold text-cream">
                Up to <span className="text-lime-300">{formatScore(rules.scoring.maxScore)} points</span> per round
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                Land within {formatScore(rules.scoring.fullScoreKm)} km for the full score. Points fall with distance and
                reach zero at {formatScore(rules.scoring.zeroScoreKm)} km. In multiplayer, your score adds up across rounds.
              </p>
            </div>
          </div>
        </motion.div>}

        <motion.div variants={staggerItem} className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">Ready to give it a go?</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button size="lg" icon="play" to="/singleplayer">
              Play singleplayer
            </Button>
            <Button size="lg" variant="secondary" icon="users" to="/multiplayer">
              Multiplayer
            </Button>
          </div>
          <Link to="/" className="text-sm font-bold text-subtle hover:text-cream">
            Back home
          </Link>
        </motion.div>
      </motion.div>

      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  )
}
