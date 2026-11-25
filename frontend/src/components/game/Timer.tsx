import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { formatClock } from '../../lib/format'
import { Icon } from '../ui/Icon'

/** Countdown clock driven by a round deadline. */
export function Timer({
  endsAt,
  onExpired,
  paused = false,
  label = 'Time remaining',
  warningAtSeconds = 30,
}: {
  endsAt: string | null
  onExpired?: () => void
  paused?: boolean
  label?: string
  warningAtSeconds?: number
}) {
  const [now, setNow] = useState(() => Date.now())
  const notifiedDeadline = useRef<string | null>(null)

  useEffect(() => {
    if (!endsAt) return
    const tick = () => setNow(Date.now())
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [endsAt])

  const remaining = endsAt ? Math.max(0, (new Date(endsAt).getTime() - now) / 1000) : 0
  const low = remaining <= warningAtSeconds && remaining > 0
  const clock = formatClock(Math.ceil(remaining))

  useEffect(() => {
    if (paused || !endsAt || remaining > 0 || notifiedDeadline.current === endsAt || !onExpired) return
    notifiedDeadline.current = endsAt
    onExpired()
  }, [remaining, endsAt, onExpired, paused])

  return (
    <div
      className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 font-display text-lg font-semibold tabular-nums ${
        low
          ? 'animate-pulse border-rose-400/50 bg-rose-400/15 text-rose-300'
          : 'border-white/8 bg-space-700 text-cream shadow-card'
      }`}
      aria-label={`${label} ${clock}`}
    >
      <Icon name="timer" size={18} />
      <motion.span key={Math.ceil(remaining)} initial={{ scale: 1.08 }} animate={{ scale: 1 }}>
        {clock}
      </motion.span>
    </div>
  )
}
