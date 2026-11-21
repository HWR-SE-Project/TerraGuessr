import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'
import { staggerContainer, staggerItem } from '../../lib/motion'

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'globe',
    title: 'You appear somewhere',
    text: 'Each round drops you into a random Street View panorama anywhere on Earth.',
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
    text: 'The closer your guess, the more points. A perfect guess scores 5,000.',
  },
]

const DIFFICULTIES = [
  { name: 'Easy', items: ['7 minutes', '3 attempts', 'Pick from 6 cities', 'Free clues'] },
  { name: 'Medium', items: ['4 minutes', '2 attempts', 'World map', 'Clues cost 100 pts'] },
  { name: 'Hard', items: ['2 minutes', '1 attempt', 'World map', 'Clues cost 20 s'] },
]

export function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-8">
        <motion.div variants={staggerItem} className="text-center">
          <p className="eyebrow">How to play</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-cream">Become a master explorer</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            A minute to learn, a lifetime to master. Here's everything you need.
          </p>
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

        <motion.div variants={staggerItem}>
          <h2 className="mb-4 text-center font-display text-2xl font-semibold text-cream">Difficulty at a glance</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {DIFFICULTIES.map((difficulty) => (
              <div key={difficulty.name} className="surface-flat p-5">
                <h3 className="font-display text-lg font-semibold text-lime-300">{difficulty.name}</h3>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {difficulty.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted">
                      <Icon name="check" size={14} className="text-lime-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={staggerItem}>
          <h2 className="mb-4 text-center font-display text-2xl font-semibold text-cream">Scoring</h2>
          <div className="surface p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-display text-3xl font-semibold text-cream">
                Up to <span className="text-lime-300">5,000 points</span> per round
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                Land within 100 km for the full score. Points fall off smoothly with distance and
                reach zero around 20,000 km. In multiplayer, your score stacks across every round.
              </p>
            </div>
          </div>
        </motion.div>

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
    </div>
  )
}
