import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/SessionContext'
import * as dailyApi from '../../api/daily'
import { mapApiError } from '../../api/errorMessages'
import type { DailyLeaderboardResponse, DailyTodayResponse, LatLon } from '../../api/types'
import { WeatherPanel } from '../../components/WeatherPanel'
import { MapPicker } from '../../components/map/MapPicker'
import './DailyPage.css'

export function DailyPage() {
  const navigate = useNavigate()
  const { status, user, dailyStreak, refresh } = useSession()
  const [today, setToday] = useState<DailyTodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guess, setGuess] = useState<LatLon | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardResponse | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    dailyApi
      .getDailyToday()
      .then((response) => {
        if (cancelled) return
        setToday(response)
        return dailyApi.getDailyLeaderboard(response.date)
      })
      .then((board) => {
        if (!cancelled && board) setLeaderboard(board)
      })
      .catch((cause) => {
        if (!cancelled) setError(mapApiError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function submitGuess() {
    if (!guess || !today) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await dailyApi.submitDailyGuess(guess)
      setToday({ ...today, status: 'completed', result: response.result })
      const board = await dailyApi.getDailyLeaderboard(today.date)
      setLeaderboard(board)
      await refresh()
    } catch (cause) {
      setError(mapApiError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="tg-daily-page">
        <div className="tg-daily-shell">
          <p className="tg-daily-loading">Loading today's challenge…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="tg-daily-page">
        <div className="tg-daily-shell">
          <h1 className="tg-daily-title">Daily challenge</h1>
          <p className="tg-daily-subtitle">Sign in to play today's shared challenge and track your streak.</p>
          <button type="button" className="tg-daily-cta" onClick={() => navigate('/auth')}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  if (error && !today) {
    return (
      <div className="tg-daily-page">
        <div className="tg-daily-shell">
          <p className="tg-daily-error" role="alert">{error}</p>
        </div>
      </div>
    )
  }

  if (!today) return null

  return (
    <div className="tg-daily-page">
      <div className="tg-daily-shell">
        <div className="tg-daily-header">
          <div>
            <div className="tg-daily-eyebrow">{today.date}</div>
            <h1 className="tg-daily-title">Daily challenge</h1>
          </div>
          <div className="tg-daily-streak">
            <span className="tg-daily-streak-value">{dailyStreak.current}</span>
            <span className="tg-daily-streak-label">day streak</span>
          </div>
        </div>

        {today.status === 'open' ? (
          <>
            <div className="tg-daily-body">
              <WeatherPanel weather={today.round.weather} access={today.round.additionalData} />
              <div className="tg-daily-map">
                <MapPicker guess={guess} onChange={setGuess} />
              </div>
            </div>
            {error && <p className="tg-daily-error" role="alert">{error}</p>}
            <button type="button" className="tg-daily-cta" disabled={!guess || submitting} onClick={submitGuess}>
              {submitting ? 'Submitting…' : 'Submit guess'}
            </button>
          </>
        ) : (
          today.result && (
            <div className="tg-daily-body">
              <div className="tg-daily-result-score">
                <span className="tg-daily-result-value">{today.result.score.toLocaleString()}</span>
                <span className="tg-daily-result-label">points · {today.result.distanceKm.toFixed(1)} km away</span>
              </div>
              <div className="tg-daily-map">
                <MapPicker guess={today.result.guess} actual={today.result.actual} onChange={() => {}} interactive={false} center={today.result.actual} zoom={3} />
              </div>
            </div>
          )
        )}

        {leaderboard && (
          <div className="tg-daily-leaderboard">
            <h2 className="tg-daily-leaderboard-title">Today's leaderboard</h2>
            {leaderboard.entries.length === 0 ? (
              <p className="tg-daily-leaderboard-empty">No guesses yet today — be the first.</p>
            ) : (
              <ol className="tg-daily-leaderboard-list">
                {leaderboard.entries.map((entry) => (
                  <li key={entry.rank} className={entry.isCurrentUser ? 'tg-daily-leaderboard-row tg-daily-leaderboard-row--me' : 'tg-daily-leaderboard-row'}>
                    <span>#{entry.rank}</span>
                    <span>{entry.displayName}</span>
                    <span>{entry.distanceKm.toFixed(1)} km</span>
                    <span>{entry.score.toLocaleString()} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
