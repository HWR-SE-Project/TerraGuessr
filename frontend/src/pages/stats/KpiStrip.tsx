import type { PlayerStatistics } from '../../lib/contracts'
import { formatDistance, formatScore } from '../../lib/format'

function DeltaBadge({
  value,
  unit = '',
  invertGood = false,
}: {
  value: number | null
  unit?: string
  invertGood?: boolean
}) {
  if (value === null) return null
  if (value === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-subtle">
        0{unit} vs prev
      </span>
    )
  }
  const positive = value > 0
  const isGood = invertGood ? !positive : positive
  const formatted = `${positive ? '+' : ''}${
    Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1)
  }${unit}`
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
        isGood ? 'bg-lime-400/15 text-lime-300' : 'bg-rose-400/15 text-rose-300'
      }`}
    >
      {formatted}
    </span>
  )
}

export function KpiStrip({ stats }: { stats: PlayerStatistics }) {
  const { kpis } = stats

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="surface-flat flex flex-col justify-between gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">Avg score</span>
          <DeltaBadge value={kpis.deltas.averageScore} />
        </div>
        <p className="font-display text-3xl font-semibold text-cream">
          {kpis.averageScore !== null ? formatScore(kpis.averageScore) : '—'}
        </p>
        <p className="text-xs text-subtle">out of 5,000 pts / round</p>
      </div>

      <div className="surface-flat flex flex-col justify-between gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">
            Median distance
          </span>
          <DeltaBadge value={kpis.deltas.medianDistanceKm} unit=" km" invertGood />
        </div>
        <p className="font-display text-3xl font-semibold text-sky-300">
          {formatDistance(kpis.medianDistanceKm)}
        </p>
        <p className="text-xs text-subtle">
          Mean: <span className="font-semibold text-muted">{formatDistance(kpis.averageDistanceKm)}</span>
        </p>
      </div>

      <div className="surface-flat flex flex-col justify-between gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">
            Rounds played
          </span>
          <DeltaBadge value={kpis.deltas.roundsPlayed} />
        </div>
        <p className="font-display text-3xl font-semibold text-cream">
          {kpis.roundsPlayed.toLocaleString('en-US')}
        </p>
        <p className="text-xs text-subtle">
          Across <span className="font-semibold text-muted">{kpis.matchesPlayed}</span>{' '}
          {kpis.matchesPlayed === 1 ? 'match' : 'matches'}
        </p>
      </div>

      <div className="surface-flat flex flex-col justify-between gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-subtle">5K rate</span>
          <DeltaBadge value={kpis.deltas.perfectRate} unit="%" />
        </div>
        <p className="font-display text-3xl font-semibold text-lime-300">
          {kpis.perfectRate !== null ? `${kpis.perfectRate.toFixed(1)}%` : '—'}
        </p>
        <p className="text-xs text-subtle">
          {kpis.perfectCount} {kpis.perfectCount === 1 ? 'bullseye' : 'bullseyes'} (≤ 100 km)
        </p>
      </div>
    </div>
  )
}
