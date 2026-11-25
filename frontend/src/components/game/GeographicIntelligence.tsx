import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AdditionalDataAccess, GeographicIntelligence as Intelligence } from '../../lib/contracts'
import { formatPercent } from '../../lib/format'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

type WeatherResponse = { roundKey: string; retry: number; data: Intelligence | null }

const WEATHER_MAX_DISPLAY_AGE_MS = 120 * 60 * 1000

function weatherIcon(condition: string | null | undefined): IconName {
  if (condition?.includes('Snow')) return 'snow'
  if (condition && /rain|drizzle|thunderstorm/i.test(condition)) return 'rain'
  if (condition === 'Clear sky' || condition === 'Mainly clear') return 'sun'
  return 'cloud'
}

function measurement(value: number | null | undefined, unit: string, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits }) + unit
}

function windMeasurement(speedKmh: number | null, directionDeg: number | null): string {
  const speed = measurement(speedKmh == null ? null : speedKmh / 3.6, ' m/s', 1)
  if (speed === '—' || directionDeg == null) return speed
  const heading = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(directionDeg / 45) % 8]
  return heading ? `${speed} ${heading}` : speed
}

/** Collapsible geographic intelligence (weather + environment clues). */
export function GeographicIntelligence({
  load,
  roundId,
  roundKey,
  access = { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
  onUnlock,
  unlocking = false,
  unlockDisabled = false,
  defaultExpanded = true,
}: {
  load: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
  roundId: string
  /** Re-fetch when this changes (e.g. new round/pano). */
  roundKey: string
  access?: AdditionalDataAccess
  onUnlock?: () => void
  unlocking?: boolean
  unlockDisabled?: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [response, setResponse] = useState<WeatherResponse | null>(null)
  const [retry, setRetry] = useState(0)
  const unlocked = access.unlocked

  useEffect(() => {
    const controller = new AbortController()
    let expiresAt = 0
    let expiryTimer: number | undefined

    function refreshWhenExpired() {
      if (!expiresAt) return
      window.clearTimeout(expiryTimer)
      const remaining = expiresAt - Date.now()
      if (remaining > 0) {
        expiryTimer = window.setTimeout(refreshWhenExpired, Math.min(remaining, WEATHER_MAX_DISPLAY_AGE_MS))
      } else {
        expiresAt = 0
        setRetry((attempt) => attempt + 1)
      }
    }

    document.addEventListener('visibilitychange', refreshWhenExpired)
    load(roundId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        // Exactly 120 minutes old is still valid. Hide and refresh on the next millisecond.
        const deadline = Date.parse(data.weather?.modelTime ?? '') + WEATHER_MAX_DISPLAY_AGE_MS + 1
        if (deadline > Date.now()) expiresAt = deadline
        setResponse({ roundKey, retry, data: expiresAt ? data : { ...data, weather: null } })
        refreshWhenExpired()
      })
      .catch(() => {
        if (!controller.signal.aborted) setResponse({ roundKey, retry, data: null })
      })
    return () => {
      controller.abort()
      window.clearTimeout(expiryTimer)
      document.removeEventListener('visibilitychange', refreshWhenExpired)
    }
  }, [load, roundId, roundKey, retry, unlocked])

  const request = response?.roundKey === roundKey && response.retry === retry ? response : null
  const data = request?.data
  const weather = data?.weather ?? null
  const temperature = measurement(weather?.temperatureC, '°C', 1)
  const environment = data?.environment
  const canUnlock = access.mode !== 'immediate' && !unlocked && onUnlock

  const unlockLabel =
    access.mode === 'points'
      ? `Unlock · −${access.cost ?? 0} pts`
      : access.mode === 'time'
        ? `Unlock · −${access.cost ?? 0}s`
        : 'Unlock'

  return (
    <aside className="surface-flat overflow-hidden" aria-label="Geographic intelligence">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
          <Icon name="scan" size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-xs font-semibold uppercase tracking-widest text-lime-300">
            Geographic intelligence
          </span>
          <span className="block text-sm text-muted">
            {!request
              ? 'Connecting…'
              : weather
                ? `${temperature}${unlocked && weather.condition ? ` · ${weather.condition}` : ''}`
                : 'Environmental clues'}
          </span>
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="chevronDown" size={18} className="text-subtle" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-4 py-3">
              {data && canUnlock && (
                <div className="mb-3 rounded-2xl bg-space-800 p-3">
                  <p className="text-sm text-muted">Extra clues are locked for this difficulty.</p>
                  <button
                    type="button"
                    disabled={unlocking || unlockDisabled}
                    onClick={onUnlock}
                    className="mt-2 rounded-full bg-lime-400 px-3 py-1.5 text-sm font-bold text-ink"
                  >
                    {unlocking ? 'Unlocking…' : unlockLabel}
                  </button>
                </div>
              )}
              {!request ? (
                <p className="py-2 text-sm text-muted">Connecting to the weather station…</p>
              ) : !weather ? (
                <div className="flex flex-col gap-2 py-1">
                  <p role="status" className="text-sm text-muted">Current weather unavailable. Try again.</p>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-lime-400/15 px-3 py-1.5 text-sm font-bold text-lime-300"
                    onClick={() => setRetry((r) => r + 1)}
                  >
                    Retry ↻
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-2xl text-sky-300">
                      <Icon name={weatherIcon(unlocked ? weather.condition : null)} size={26} />
                    </span>
                    <div className="min-w-0 flex-1 wrap-anywhere">
                      <span className="block text-xs text-subtle">Temperature</span>
                      <span className="font-display text-2xl font-semibold text-cream">
                        {temperature}
                      </span>
                      <span className="ml-2 text-sm font-semibold text-muted">
                        {unlocked ? (weather.condition ?? 'Conditions unavailable') : 'Conditions locked'}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Metric icon="rain" label="Precipitation" value={measurement(weather.precipitationMm, ' mm', 1)} />
                    <Metric icon="drop" label="Humidity" value={formatPercent(weather.humidityPct)} />
                    <Metric icon="wind" label="Wind speed" value={windMeasurement(weather.windSpeedKmh, weather.windDirectionDeg)} />
                    {unlocked && <Metric icon="pressure" label="Pressure" value={measurement(weather.pressureHpa, ' hPa')} />}
                  </dl>
                </>
              )}

              {unlocked && environment?.elevationM != null && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-space-800 p-3">
                  <span className="text-lime-300">
                    <Icon name="mountain" size={20} />
                  </span>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-subtle">Elevation</span>
                    <span className="font-display text-lg font-semibold text-cream">
                      {measurement(environment.elevationM, ' m')}
                      <span className="ml-2 text-sm font-semibold text-muted">{environment.terrain}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-space-800 px-3 py-2">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-subtle">
        <Icon name={icon} size={14} className="shrink-0" />
        <span className="min-w-0 wrap-anywhere">{label}</span>
      </dt>
      <dd className="min-w-0 wrap-anywhere text-sm font-bold text-cream tabular-nums">{value}</dd>
    </div>
  )
}
