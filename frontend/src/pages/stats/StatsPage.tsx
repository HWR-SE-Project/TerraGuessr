import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { staggerContainer, staggerItem } from '../../lib/motion'
import { useSession } from '../../state/session'
import { MatchesTab } from './MatchesTab'
import { OverviewTab } from './OverviewTab'

type StatsTab = 'overview' | 'matches'

export function StatsPage() {
  const session = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: StatsTab = rawTab === 'matches' ? 'matches' : 'overview'

  function selectTab(next: StatsTab) {
    if (next === 'overview') {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('tab')
      setSearchParams(nextParams, { replace: true })
    } else {
      setSearchParams({ tab: next }, { replace: true })
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-6"
      >
        <motion.div
          variants={staggerItem}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="eyebrow">Statistics</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-cream sm:text-4xl">
              Your exploration log
            </h1>
            <p className="mt-1 text-sm text-muted">
              Performance trends, streaks, biome mastery, and match replays across the last 6 months.
            </p>
          </div>

          {session.status === 'authed' && (
            <div
              className="inline-flex rounded-full border border-white/10 bg-space-800 p-1"
              role="tablist"
              aria-label="Statistics sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => selectTab('overview')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-lime-400/18 text-lime-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                <Icon name="chart" size={16} />
                Overview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'matches'}
                onClick={() => selectTab('matches')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === 'matches'
                    ? 'bg-lime-400/18 text-lime-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                <Icon name="pin" size={16} />
                Matches
              </button>
            </div>
          )}
        </motion.div>

        {session.status === 'loading' ? (
          <div className="surface-flat h-48 animate-pulse bg-space-700/70" aria-busy="true" />
        ) : session.status !== 'authed' ? (
          <motion.div variants={staggerItem} className="surface flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-lg">
                <h2 className="font-display text-2xl font-semibold text-cream">
                  Sign in to track your stats
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Guest rounds aren’t archived. Create a free account or sign in to keep up to 6
                  months of rolling trends, streaks, biome breakdowns, and interactive match
                  replays.
                </p>
              </div>
              <Button to="/auth" icon="person" className="shrink-0">
                Sign in
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: 'chart' as const,
                  title: 'Trends & Deltas',
                  text: 'Track score and median distance across 7D, 30D, 90D, and 6M windows.',
                },
                {
                  icon: 'flame' as const,
                  title: 'Streaks & Mastery',
                  text: 'Spot your best biomes, extra-intel payoff, and 5K streaks.',
                },
                {
                  icon: 'pin' as const,
                  title: 'Match Replays',
                  text: 'Inspect every completed game on a world map with geodesic arcs.',
                },
              ].map((card) => (
                <div key={card.title} className="surface-flat p-4">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                    <Icon name={card.icon} size={18} />
                  </span>
                  <h3 className="mt-3 font-display text-base font-semibold text-cream">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{card.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div variants={staggerItem}>
            {activeTab === 'overview' ? <OverviewTab /> : <MatchesTab />}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
