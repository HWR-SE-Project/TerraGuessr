import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { formatClock } from '../../lib/format'
import { Icon } from '../ui/Icon'

/** Countdown clock driven by a round deadline. */
export function Timer({
  endsAt,
  onExpired,
  paused = false,
}: {
  endsAt: string | null
  onExpired?: () => void
  paused?: boolean
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!endsAt) return
    const tick = () => setNow(Date.now())
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [endsAt])

  const remaining = endsAt ? Math.max(0, (new Date(endsAt).getTime() - now) / 1000) : 0
  const low = remaining <= 30 && remaining > 0

  useEffect(() => {
    if (!paused && endsAt && remaining <= 0) onExpired?.()
  }, [remaining, endsAt, onExpired, paused])

  return (
    <div
      className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 font-display text-lg font-semibold tabular-nums ${
        low
          ? 'animate-pulse border-rose-400/50 bg-rose-400/15 text-rose-300'
          : 'border-white/10 bg-space-700 text-cream'
      }`}
      aria-label={`Time remaining ${formatClock(remaining)}`}
    >
      <Icon name="timer" size={18} />
      <motion.span key={Math.ceil(remaining)} initial={{ scale: 1.08 }} animate={{ scale: 1 }}>
        {formatClock(remaining)}
      </motion.span>
    </div>
  )
}
