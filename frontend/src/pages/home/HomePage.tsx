import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Dropdown } from '../../components/ui/Dropdown'
import { Icon } from '../../components/ui/Icon'
import { useSession } from '../../state/session'
import { fadeUp, staggerContainer, staggerItem } from '../../lib/motion'
import earthFallback from '../../assets/images/earth-horizon.webp'

// Lazy-load the heavy R3F scene so `three` stays out of the initial chunk.
const HomeScene = lazy(() =>
  import('../../scene/HomeScene').then((m) => ({ default: m.HomeScene })),
)

const MODES = [
  {
    to: '/singleplayer',
    icon: 'compass' as const,
    title: 'Singleplayer',
    text: 'Drop into a street anywhere on Earth and find your way.',
  },
  {
    to: '/multiplayer',
    icon: 'users' as const,
    title: 'Multiplayer',
    text: 'Challenge friends in a live lobby and race to the right spot.',
  },
  {
    to: '/avatar',
    icon: 'person' as const,
    title: 'Your explorer',
    text: 'Style your own little explorer for every adventure.',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const session = useSession()

  return (
    <div className="relative">
      <section className="relative min-h-[calc(100dvh-4rem)]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 pb-12 pt-6 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:gap-4">
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="max-w-xl">
            <motion.p variants={staggerItem} className="eyebrow">
              A geography guessing game
            </motion.p>
            <motion.h1
              variants={staggerItem}
              className="mt-3 text-balance font-display text-4xl font-semibold leading-[1.05] text-cream sm:text-5xl lg:text-6xl"
            >
              Find your place
              <br />
              in the world<span className="text-lime-400">.</span>
            </motion.h1>
            <motion.p variants={staggerItem} className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              You're dropped somewhere on Earth. Read the streets, the skies and the
              weather — then guess where you are.
            </motion.p>

            <motion.div variants={staggerItem} className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" icon="play" onClick={() => navigate('/singleplayer')}>
                Play singleplayer
              </Button>
              <Dropdown
                align="start"
                trigger={({ toggle, ref }) => (
                  <button
                    ref={ref}
                    onClick={toggle}
                    className="btn-base btn-press h-14 px-7 text-lg rounded-2xl bg-space-600 text-cream hover:bg-space-500 border border-white/10 shadow-card"
                  >
                    <Icon name="users" size={22} />
                    Multiplayer
                    <Icon name="chevronDown" size={18} />
                  </button>
                )}
                items={[
                  { key: 'create', label: 'Create a lobby', icon: <Icon name="plus" size={18} />, onSelect: () => navigate('/multiplayer?mode=create') },
                  { key: 'join', label: 'Join with a code', icon: <Icon name="search" size={18} />, onSelect: () => navigate('/multiplayer?mode=join') },
                ]}
              />
            </motion.div>

            {session.status === 'guest' && (
              <motion.p variants={staggerItem} className="mt-5 text-sm text-subtle">
                New here?{' '}
                <button onClick={() => navigate('/auth')} className="font-bold text-lime-300 hover:underline">
                  Create a free account
                </button>{' '}
                to save your explorer and history.
              </motion.p>
            )}
          </motion.div>

          {/* 3D visual: planet + explorer, with a measured character slot. */}
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="relative h-[380px] w-full sm:h-[440px] lg:h-[540px]"
          >
            <Suspense
              fallback={
                <div className="absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
                  <img src={earthFallback} alt="" className="h-full w-full object-cover opacity-70" />
                </div>
              }
            >
              <HomeScene />
            </Suspense>
            <div className="home-character-slot pointer-events-none absolute left-1/2 top-[4%] h-[84%] w-[64%] -translate-x-1/2 sm:w-[58%]" />
          </motion.div>
        </div>
      </section>

      {/* Mode cards */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map((mode) => (
            <motion.button
              key={mode.to}
              variants={staggerItem}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(mode.to)}
              className="surface group flex flex-col items-start gap-3 p-6 text-left transition-transform hover:-translate-y-1"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Icon name={mode.icon} size={24} />
              </span>
              <span className="font-display text-xl font-semibold text-cream">{mode.title}</span>
              <span className="text-sm leading-relaxed text-muted">{mode.text}</span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-lime-300">
                Go <Icon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  )
}
