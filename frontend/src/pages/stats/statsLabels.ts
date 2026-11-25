import type {
  AccuracyBand,
  CalloutTone,
  ConsistencyTier,
  StatsDifficultyFilter,
  StatsModeFilter,
  StatsPeriod,
} from '../../lib/contracts'

export const PERIOD_OPTIONS: Array<{ value: StatsPeriod; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '6m', label: '6M' },
]

export const MODE_OPTIONS: Array<{ value: StatsModeFilter; label: string }> = [
  { value: 'all', label: 'All modes' },
  { value: 'solo', label: 'Solo' },
  { value: 'multiplayer', label: 'Multiplayer' },
]

export const DIFFICULTY_OPTIONS: Array<{ value: StatsDifficultyFilter; label: string }> = [
  { value: 'all', label: 'All difficulties' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export const ACCURACY_BAND_META: Record<
  AccuracyBand,
  { label: string; range: string; barClass: string }
> = {
  bullseye: { label: 'Bullseye (5K)', range: '≤ 100 km', barClass: 'bg-lime-400' },
  close: { label: 'Close', range: '100 – 500 km', barClass: 'bg-sky-400' },
  regional: { label: 'Regional', range: '500 – 2,000 km', barClass: 'bg-violet-400' },
  continent: { label: 'Continental', range: '2,000 – 5,000 km', barClass: 'bg-amber-400' },
  far: { label: 'Far', range: '> 5,000 km', barClass: 'bg-rose-400' },
  missed: { label: 'Timed out', range: 'No guess', barClass: 'bg-white/25' },
}

export const CONSISTENCY_TIER_META: Record<
  ConsistencyTier,
  { label: string; description: string; badgeClass: string; meterPct: number }
> = {
  rock_solid: {
    label: 'Rock Solid',
    description: 'Tight score clustering — very steady round-to-round.',
    badgeClass: 'bg-lime-400/15 text-lime-300 border-lime-400/30',
    meterPct: 95,
  },
  steady: {
    label: 'Steady',
    description: 'Reliable accuracy with occasional standout or off rounds.',
    badgeClass: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
    meterPct: 72,
  },
  balanced: {
    label: 'Balanced',
    description: 'A mix of pinpoint hits and exploratory misses.',
    badgeClass: 'bg-violet-400/15 text-violet-300 border-violet-400/30',
    meterPct: 48,
  },
  wildcard: {
    label: 'Wildcard',
    description: 'High variance — big highs paired with bold swings.',
    badgeClass: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    meterPct: 24,
  },
}

export const CALLOUT_TONE_CLASS: Record<CalloutTone, string> = {
  lime: 'border-lime-400/25 bg-lime-400/8 text-lime-300',
  sky: 'border-sky-400/25 bg-sky-400/8 text-sky-300',
  amber: 'border-amber-400/25 bg-amber-400/8 text-amber-300',
  violet: 'border-violet-400/25 bg-violet-400/8 text-violet-300',
}

export function formatShortDate(isoOrYmd: string): string {
  const date = new Date(isoOrYmd.length === 10 ? `${isoOrYmd}T00:00:00Z` : isoOrYmd)
  if (Number.isNaN(date.getTime())) return isoOrYmd
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatMatchDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatPlacement(placement: number, playerCount: number): string {
  const suffix =
    placement % 100 >= 11 && placement % 100 <= 13
      ? 'th'
      : placement % 10 === 1
        ? 'st'
        : placement % 10 === 2
          ? 'nd'
          : placement % 10 === 3
            ? 'rd'
            : 'th'
  return `${placement}${suffix} / ${playerCount}`
}

export function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const rounded = Math.max(0, Math.round(seconds))
  if (rounded < 60) return `${rounded}s`
  const mins = Math.floor(rounded / 60)
  const rem = rounded % 60
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`
}
