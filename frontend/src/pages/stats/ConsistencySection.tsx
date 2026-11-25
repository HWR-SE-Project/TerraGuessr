import type { PlayerStatistics } from '../../lib/contracts'
import { Icon } from '../../components/ui/Icon'

export function ConsistencySection({
  consistency,
}: {
  consistency: PlayerStatistics['consistency']
}) {
  return (
    <section className="surface flex flex-col gap-4 p-5 sm:p-6" aria-label="Streaks">
      <div>
        <h2 className="font-display text-lg font-semibold text-cream">Streaks</h2>
        <p className="mt-1 text-xs text-subtle">
          Play-day streaks span your 6-month archive; 5K streaks reflect your current filters.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface-flat flex items-center gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
            <Icon name="flame" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">Play streak</p>
            <p className="mt-0.5 font-display text-xl font-semibold text-cream">
              {consistency.currentPlayStreakDays}{' '}
              <span className="text-sm font-normal text-muted">
                {consistency.currentPlayStreakDays === 1 ? 'day' : 'days'}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              Best: {consistency.bestPlayStreakDays}{' '}
              {consistency.bestPlayStreakDays === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        <div className="surface-flat flex items-center gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
            <Icon name="sparkle" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">5K streak</p>
            <p className="mt-0.5 font-display text-xl font-semibold text-cream">
              {consistency.currentPerfectStreak}{' '}
              <span className="text-sm font-normal text-muted">in a row</span>
            </p>
            <p className="mt-0.5 text-xs text-subtle">
              Best in period: {consistency.bestPerfectStreak}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
