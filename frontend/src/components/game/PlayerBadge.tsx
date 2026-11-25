import { hueFromString, initials } from '../../lib/format'

export function PlayerBadge({ name, compact = false }: { name: string | null; compact?: boolean }) {
  const label = name ?? '?'
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-ink ${compact ? 'size-6 text-[10px] font-bold' : 'size-9 font-display text-sm font-semibold'}`}
      style={{ background: `hsl(${hueFromString(label)} 70% 72%)` }}
    >
      {initials(label)}
    </span>
  )
}
