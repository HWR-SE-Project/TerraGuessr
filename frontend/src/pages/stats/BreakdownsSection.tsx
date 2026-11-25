import { useState } from 'react'
import type { CategoryBreakdownItem, Difficulty, GameMode, PlayerStatistics } from '../../lib/contracts'
import { capitalize, formatDistance, formatScore } from '../../lib/format'
import { ACCURACY_BAND_META, formatDurationSeconds } from './statsLabels'

type EnvironmentTab = 'biome' | 'weather' | 'temperature'

const MODES: GameMode[] = ['solo', 'multiplayer']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function CategoryList({ items }: { items: CategoryBreakdownItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-subtle">
        No recorded rounds for this breakdown yet.
      </p>
    )
  }
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(4, (item.averageScore / 5000) * 100))
        return (
          <li key={item.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-bold text-cream">
                {capitalize(item.key)}
                <span className="ml-2 font-normal text-subtle">({item.rounds})</span>
              </span>
              <span className="text-muted">
                <strong className="text-cream">{formatScore(item.averageScore)}</strong> pts ·{' '}
                {formatDistance(item.medianDistanceKm)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-space-850">
              <div
                className="h-full rounded-full bg-sky-400/80 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function BreakdownsSection({ stats }: { stats: PlayerStatistics }) {
  const [envTab, setEnvTab] = useState<EnvironmentTab>('biome')

  const envItems =
    envTab === 'biome'
      ? stats.environment.byBiome
      : envTab === 'weather'
        ? stats.environment.byWeather
        : stats.environment.byTemperatureBand

  const matrixLookup = new Map(
    stats.modeDifficultyMatrix.map((cell) => [`${cell.mode}:${cell.difficulty}`, cell]),
  )

  const { hints } = stats.strategy
  const hasStrategyData =
    stats.strategy.elapsedSampleSize > 0 ||
    stats.strategy.attemptsSampleSize > 0 ||
    stats.strategy.hintsSampleSize > 0

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Accuracy Distribution */}
      <section className="surface p-5 sm:p-6" aria-label="Accuracy distribution">
        <h2 className="font-display text-lg font-semibold text-cream">Accuracy distribution</h2>
        <p className="text-xs text-subtle">Share of rounds by distance from the true location.</p>

        <ul className="mt-4 flex flex-col gap-3">
          {stats.accuracyDistribution.map((entry) => {
            const meta = ACCURACY_BAND_META[entry.band]
            return (
              <li key={entry.band} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-bold text-cream">
                    {meta.label}{' '}
                    <span className="font-normal text-subtle">{meta.range}</span>
                  </span>
                  <span className="text-muted">
                    <strong className="text-cream">{entry.count}</strong> ({entry.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-space-850">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${meta.barClass}`}
                    style={{ width: `${entry.count === 0 ? 0 : Math.max(3, entry.percentage)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Mode x Difficulty Matrix */}
      <section className="surface p-5 sm:p-6" aria-label="Mode and difficulty breakdown">
        <h2 className="font-display text-lg font-semibold text-cream">Mode × Difficulty</h2>
        <p className="text-xs text-subtle">
          Full comparison across all modes and difficulties in the selected time period.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-2 text-left text-xs">
            <thead>
              <tr>
                <th className="pb-1 text-[11px] font-bold uppercase tracking-wider text-subtle">
                  Mode
                </th>
                {DIFFICULTIES.map((diff) => (
                  <th
                    key={diff}
                    className="pb-1 text-center text-[11px] font-bold uppercase tracking-wider text-subtle"
                  >
                    {capitalize(diff)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODES.map((mode) => (
                <tr key={mode}>
                  <td className="pr-2 font-display text-sm font-semibold text-cream">
                    {capitalize(mode)}
                  </td>
                  {DIFFICULTIES.map((difficulty) => {
                    const cell = matrixLookup.get(`${mode}:${difficulty}`)
                    const isHighlighted =
                      (stats.mode === 'all' || stats.mode === mode) &&
                      (stats.difficulty === 'all' || stats.difficulty === difficulty)
                    return (
                      <td
                        key={difficulty}
                        className={`rounded-2xl border p-3 text-center transition-opacity ${
                          isHighlighted
                            ? 'border-white/10 bg-space-800/80'
                            : 'border-white/5 bg-space-850/40 opacity-45'
                        }`}
                      >
                        {cell && cell.rounds > 0 ? (
                          <>
                            <p className="font-display text-base font-semibold text-cream">
                              {cell.averageScore !== null ? formatScore(cell.averageScore) : '—'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-sky-300">
                              {formatDistance(cell.medianDistanceKm)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-subtle">
                              {cell.rounds} {cell.rounds === 1 ? 'rd' : 'rds'}
                            </p>
                          </>
                        ) : (
                          <p className="py-2 text-subtle">—</p>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Environment Breakdown (Biome / Weather / Temperature) */}
      <section className="surface p-5 sm:p-6" aria-label="Environment performance">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">Environment</h2>
            <p className="text-xs text-subtle">
              {stats.environment.sampleSize > 0
                ? `Based on ${stats.environment.sampleSize} enriched ${
                    stats.environment.sampleSize === 1 ? 'round' : 'rounds'
                  }.`
                : 'Recorded automatically on newly completed rounds.'}
            </p>
          </div>
          <div
            className="inline-flex rounded-full border border-white/10 bg-space-800 p-1"
            role="group"
            aria-label="Environment category"
          >
            {(
              [
                { id: 'biome', label: 'Biome' },
                { id: 'weather', label: 'Weather' },
                { id: 'temperature', label: 'Temp' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEnvTab(tab.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                  envTab === tab.id
                    ? 'bg-sky-400/20 text-sky-300'
                    : 'text-muted hover:text-cream'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {stats.environment.sampleSize === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-subtle">
            Older archived rounds didn’t capture biome or weather. Play a new round to populate this breakdown.
          </div>
        ) : (
          <CategoryList items={envItems} />
        )}
      </section>

      {/* Strategy, Pacing & Hints */}
      <section className="surface p-5 sm:p-6" aria-label="Pacing and hint strategy">
        <h2 className="font-display text-lg font-semibold text-cream">Pacing & extra intel</h2>
        <p className="text-xs text-subtle">
          How fast you solve rounds and whether unlocking extra weather intel improves your score.
        </p>

        {!hasStrategyData ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-subtle">
            Solve time, attempts, and extra-intel tracking are recorded on newly completed rounds.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="surface-flat p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">Avg time</p>
                <p className="mt-1 font-display text-lg font-semibold text-cream">
                  {formatDurationSeconds(stats.strategy.averageElapsedSeconds)}
                </p>
              </div>
              <div className="surface-flat p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                  Avg guesses
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-cream">
                  {stats.strategy.averageAttemptsUsed !== null
                    ? stats.strategy.averageAttemptsUsed.toFixed(1)
                    : '—'}
                </p>
              </div>
              <div className="surface-flat p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                  Intel used
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-violet-300">
                  {hints.usageRate !== null ? `${Math.round(hints.usageRate)}%` : '—'}
                </p>
              </div>
            </div>

            {stats.strategy.hintsSampleSize > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-flat p-4">
                  <p className="text-xs font-bold text-violet-300">With extra intel</p>
                  <p className="mt-1 font-display text-xl font-semibold text-cream">
                    {hints.unlockedAvgScore !== null ? `${formatScore(hints.unlockedAvgScore)} pts` : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {hints.unlockedRounds} {hints.unlockedRounds === 1 ? 'round' : 'rounds'} · Median{' '}
                    {formatDistance(hints.unlockedMedianDistanceKm)}
                  </p>
                </div>

                <div className="surface-flat p-4">
                  <p className="text-xs font-bold text-muted">Without extra intel</p>
                  <p className="mt-1 font-display text-xl font-semibold text-cream">
                    {hints.notUnlockedAvgScore !== null
                      ? `${formatScore(hints.notUnlockedAvgScore)} pts`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {hints.notUnlockedRounds}{' '}
                    {hints.notUnlockedRounds === 1 ? 'round' : 'rounds'} · Median{' '}
                    {formatDistance(hints.notUnlockedMedianDistanceKm)}
                  </p>
                </div>
              </div>
            )}

            {hints.totalPointsSpent > 0 && (
              <p className="text-xs text-subtle">
                Total points spent on medium-mode extra intel:{' '}
                <strong className="text-muted">{formatScore(hints.totalPointsSpent)} pts</strong>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
