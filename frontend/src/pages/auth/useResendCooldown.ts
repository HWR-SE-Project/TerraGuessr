import { useCallback, useEffect, useState } from 'react'

/** Default client-side cooldown after an auth email is sent (matches backend 30s per-email cooldown). */
export const RESEND_COOLDOWN_SECONDS = 30

export function formatCooldown(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds))
  if (safe < 60) return `${safe}s`
  const minutes = Math.ceil(safe / 60)
  return `${minutes}m`
}

export function useResendCooldown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const active = remaining > 0

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [active])

  const start = useCallback((seconds: number = RESEND_COOLDOWN_SECONDS) => {
    setRemaining(Math.max(0, Math.ceil(seconds)))
  }, [])

  const reset = useCallback(() => {
    setRemaining(0)
  }, [])

  return { remaining, start, reset }
}
