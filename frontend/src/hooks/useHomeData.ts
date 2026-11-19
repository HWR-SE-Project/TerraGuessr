import { useEffect, useState } from 'react'
import { useSession } from '../state/SessionContext'
import * as dailyApi from '../api/daily'
import * as statisticsApi from '../api/statistics'
import type { DailyTodayResponse, StatisticsResponse } from '../api/types'

export interface StreakDay {
  label: string
  dayOfMonth: number
  completed: boolean
  isToday: boolean
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function buildStreakDays(completedDates: Set<string>): StreakDay[] {
  const days: StreakDay[] = []
  const today = new Date()
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - offset)
    const iso = date.toISOString().slice(0, 10)
    days.push({
      label: WEEKDAY_LABELS[date.getUTCDay()]!,
      dayOfMonth: date.getUTCDate(),
      completed: completedDates.has(iso),
      isToday: offset === 0,
    })
  }
  return days
}

function hoursUntilNextUtcMidnight(): number {
  const now = new Date()
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.max(0, Math.round((nextMidnight.getTime() - now.getTime()) / (1000 * 60 * 60)))
}

/** Shared data for the Home dashboard — fetched once and consumed by both the desktop and mobile layouts so neither duplicates the network calls. */
export function useHomeData() {
  const { user } = useSession()
  const [daily, setDaily] = useState<DailyTodayResponse | null>(null)
  const [soloStats, setSoloStats] = useState<StatisticsResponse | null>(null)
  const [streakDays, setStreakDays] = useState<StreakDay[]>(buildStreakDays(new Set()))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setDaily(null)
      setSoloStats(null)
      setStreakDays(buildStreakDays(new Set()))
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.allSettled([dailyApi.getDailyToday(), statisticsApi.getStatistics('solo', 1, 0), statisticsApi.getStatistics('daily', 30, 0)]).then(
      ([dailyResult, soloResult, streakResult]) => {
        if (cancelled) return
        if (dailyResult.status === 'fulfilled') setDaily(dailyResult.value)
        if (soloResult.status === 'fulfilled') setSoloStats(soloResult.value)
        if (streakResult.status === 'fulfilled') {
          const completedDates = new Set(streakResult.value.entries.map((entry) => entry.date))
          setStreakDays(buildStreakDays(completedDates))
        }
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [user])

  return { daily, soloStats, streakDays, loading, hoursUntilDailyReset: hoursUntilNextUtcMidnight() }
}
