import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import type {
  PlayerStatistics,
  StatsDifficultyFilter,
  StatsModeFilter,
  StatsPeriod,
} from '../../lib/contracts'
import { api } from '../../services'
import { BreakdownsSection } from './BreakdownsSection'
import { ConsistencySection } from './ConsistencySection'
import { KpiStrip } from './KpiStrip'
import { PerformanceChart } from './PerformanceChart'
import { DIFFICULTY_OPTIONS, MODE_OPTIONS, PERIOD_OPTIONS } from './statsLabels'

export function OverviewTab() {
  const [period, setPeriod] = useState<StatsPeriod>('30d')
  const [mode, setMode] = useState<StatsModeFilter>('all')
  const [difficulty, setDifficulty] = useState<StatsDifficultyFilter>('all')
  const [reloadNonce, setReloadNonce] = useState(0)
  const requestKey = `${period}:${mode}:${difficulty}:${reloadNonce}`
  const [state, setState] = useState<{
    resolvedKey: string | null
    stats: PlayerStatistics | null
    error: string | null
  }>({ resolvedKey: null, stats: null, error: null })

  useEffect(() => {
    let cancelled = false
    api.stats
      .getOverview({ period, mode, difficulty })
      .then((data) => {
        if (!cancelled) {
          setState({ resolvedKey: requestKey, stats: data, error: null })
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setState((prev) => ({
            resolvedKey: requestKey,
            stats: prev.stats,
            error: cause instanceof Error ? cause.message : 'Could not load statistics.',
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [period, mode, difficulty, requestKey])

  const loading = state.resolvedKey !== requestKey
  const stats = state.stats
  const error = state.resolvedKey === requestKey ? state.error : null

  const hasFilters = mode !== 'all' || difficulty !== 'all'

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="surface-flat flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="inline-flex rounded-full border border-white/10 bg-space-800 p-1" role="group" aria-label="Time period">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                period === opt.value
                  ? 'bg-lime-400/20 text-lime-300'
                  : 'text-muted hover:text-cream'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-white/10 bg-space-800 p-1" role="group" aria-label="Game mode filter">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={mode === opt.value}
                onClick={() => setMode(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === opt.value
                    ? 'bg-sky-400/20 text-sky-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-white/10 bg-space-800 p-1" role="group" aria-label="Difficulty filter">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={difficulty === opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  difficulty === opt.value
                    ? 'bg-violet-400/20 text-violet-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="surface-flat flex flex-wrap items-center justify-between gap-3 border-rose-400/30 px-5 py-4">
          <p className="text-sm font-semibold text-rose-300">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setReloadNonce((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      {loading && !stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="surface-flat h-28 animate-pulse bg-space-700/70"
            />
          ))}
        </div>
      ) : stats && stats.totalRetainedRounds === 0 ? (
        <div className="surface flex flex-col items-center gap-4 px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-semibold text-cream">
            No completed rounds yet
          </h2>
          <p className="max-w-md text-sm text-muted">
            Finish your first round in Singleplayer or Multiplayer and your scores, accuracy trends,
            streaks, and match replays will appear right here.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button to="/singleplayer" icon="play">
              Play Singleplayer
            </Button>
            <Button to="/multiplayer" variant="secondary" icon="users">
              Join Multiplayer
            </Button>
          </div>
        </div>
      ) : stats && stats.kpis.roundsPlayed === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
          <h2 className="font-display text-xl font-semibold text-cream">
            No rounds match these filters
          </h2>
          <p className="max-w-md text-sm text-muted">
            You have {stats.totalRetainedRounds} archived{' '}
            {stats.totalRetainedRounds === 1 ? 'round' : 'rounds'} in the last 6 months, but none
            in this selection.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {period !== '6m' && (
              <Button size="sm" onClick={() => setPeriod('6m')}>
                Expand to 6M
              </Button>
            )}
            {hasFilters && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setMode('all')
                  setDifficulty('all')
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>
      ) : stats ? (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? 'opacity-65' : 'opacity-100'}`}>
          <KpiStrip stats={stats} />
          <PerformanceChart trend={stats.trend} />
          <ConsistencySection consistency={stats.consistency} />
          <BreakdownsSection stats={stats} />
        </div>
      ) : null}
    </div>
  )
}
