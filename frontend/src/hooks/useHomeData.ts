import { useEffect, useState } from 'react'
import { useSession } from '../state/SessionContext'
import * as dailyApi from '../api/daily'
import type { DailyTodayResponse } from '../api/types'

function hoursUntilNextUtcMidnight(): number {
  const now = new Date()
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )
  return Math.max(0, Math.ceil((nextMidnight - now.getTime()) / 3_600_000))
}

/** One set of daily requests for every responsive layout; UTC dates match the daily API. */
export function useHomeData() {
  const { user } = useSession()
  const [data, setData] = useState<{
    daily: DailyTodayResponse | null
    loading: boolean
    error: boolean
  }>(() => ({
    daily: null,
    loading: true,
    error: false,
  }))
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    dailyApi.getDailyToday().then(
      (daily) => {
        if (!cancelled) setData({ daily, loading: false, error: false })
      },
      () => {
        if (!cancelled) setData({ daily: null, loading: false, error: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  return {
    ...data,
    loading: Boolean(userId) && data.loading,
    hoursUntilDailyReset: hoursUntilNextUtcMidnight(),
  }
}
