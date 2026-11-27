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

function uvMeasurement(uv: number): string {
  const formatted = uv.toLocaleString(undefined, { maximumFractionDigits: 1 })
  const level =
    uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme'
  return `${formatted} · ${level}`
}

function tempRangeMeasurement(minC: number, maxC: number): string {
  const minStr = minC.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const maxStr = maxC.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const swing = Math.round(maxC - minC)
  return `${minStr}° – ${maxStr}°C (Δ${swing}°)`
}

function defaultIntelligenceExpanded(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(min-width: 1024px)').matches
}

interface ExtraMetricItem {
  key: string
  icon: IconName
  label: string
  value: string
}

function buildExtraMetrics(weather: NonNullable<Intelligence['weather']>): ExtraMetricItem[] {
  const items: ExtraMetricItem[] = []
  if (weather.tempMin24hC != null && weather.tempMax24hC != null) {
    items.push({
      key: 'temp24h',
      icon: 'flame',
      label: '24h temp range',
      value: tempRangeMeasurement(weather.tempMin24hC, weather.tempMax24hC),
    })
  }
  if (weather.uvIndexMax24h != null) {
    items.push({
      key: 'uvMax24h',
      icon: 'sun',
      label: 'Peak UV (24h)',
      value: uvMeasurement(weather.uvIndexMax24h),
    })
  } else if (weather.uvIndex != null) {
    items.push({
      key: 'uv',
      icon: 'sun',
      label: 'Clear-sky UV',
      value: uvMeasurement(weather.uvIndex),
    })
  }
  if (weather.dewPointC != null) {
    items.push({
      key: 'dewPoint',
      icon: 'drop',
      label: 'Dew point',
      value: measurement(weather.dewPointC, '°C', 1),
    })
  }
  if (weather.precipitation24hMm != null) {
    items.push({
      key: 'precip24h',
      icon: 'rain',
      label: '24h precip',
      value: measurement(weather.precipitation24hMm, ' mm', 1),
    })
  }
  if (weather.cloudCoverPct != null) {
    items.push({
      key: 'cloudCover',
      icon: 'cloud',
      label: 'Cloud cover',
      value: formatPercent(weather.cloudCoverPct),
    })
  }
  if (weather.pressureHpa != null) {
    items.push({
      key: 'pressure',
      icon: 'pressure',
      label: 'Pressure',
      value: measurement(weather.pressureHpa, ' hPa'),
    })
  }
  if (weather.windGustKmh != null) {
    items.push({
      key: 'windGust',
      icon: 'wind',
      label: 'Wind gusts',
      value: measurement(weather.windGustKmh / 3.6, ' m/s', 1),
    })
  }
  if (weather.fogPct != null && weather.fogPct > 0) {
    items.push({
      key: 'fog',
      icon: 'cloud',
      label: 'Fog cover',
      value: formatPercent(weather.fogPct),
    })
  }
  if (weather.thunderProbabilityPct != null && weather.thunderProbabilityPct > 0) {
    items.push({
      key: 'thunder',
      icon: 'sparkle',
      label: 'Thunder risk',
      value: formatPercent(weather.thunderProbabilityPct),
    })
  }
  return items
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
  defaultExpanded,
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
  const [expanded, setExpanded] = useState(() => defaultExpanded ?? defaultIntelligenceExpanded())
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
  const extraMetrics = unlocked && weather ? buildExtraMetrics(weather) : []
  const hasUnlockedClues = unlocked && (environment?.elevationM != null || extraMetrics.length > 0)

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
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left lg:px-4 lg:py-3"
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
                ? `${temperature}${weather.condition ? ` · ${weather.condition}` : ''}`
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
            <div className="border-t border-white/8 px-3 py-2.5 lg:px-4 lg:py-3">
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
                      <Icon name={weatherIcon(weather.condition)} size={26} />
                    </span>
                    <div className="min-w-0 flex-1 wrap-anywhere">
                      <span className="block text-xs text-subtle">Temperature</span>
                      <span className="font-display text-2xl font-semibold text-cream">
                        {temperature}
                      </span>
                      {weather.condition && (
                        <span className="ml-2 text-sm font-semibold text-muted">
                          {weather.condition}
                        </span>
                      )}
                    </div>
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm lg:mt-3 lg:gap-2">
                    <Metric icon="rain" label="Precipitation" value={measurement(weather.precipitationMm, ' mm', 1)} />
                    <Metric icon="drop" label="Humidity" value={formatPercent(weather.humidityPct)} />
                    <Metric icon="wind" label="Wind speed" value={windMeasurement(weather.windSpeedKmh, weather.windDirectionDeg)} />
                  </dl>
                </>
              )}

              {data && canUnlock && (
                <div className="mt-2.5 rounded-2xl bg-space-800 p-3 lg:mt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-lime-300">
                    Additional clues locked
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Reveal elevation, 24h temperature &amp; rain forecast, peak UV, dew point, cloud cover, and pressure.
                  </p>
                  <button
                    type="button"
                    disabled={unlocking || unlockDisabled}
                    onClick={onUnlock}
                    className="mt-2.5 rounded-full bg-lime-400 px-3 py-1.5 text-sm font-bold text-ink"
                  >
                    {unlocking ? 'Unlocking…' : unlockLabel}
                  </button>
                </div>
              )}

              {hasUnlockedClues && (
                <div className="mt-2.5 border-t border-white/8 pt-2.5 lg:mt-3 lg:pt-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-subtle">
                    Station dossier
                  </span>

                  {environment?.elevationM != null && (
                    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-space-800 px-3 py-2 lg:p-2.5">
                      <span className="text-lime-300">
                        <Icon name="mountain" size={20} />
                      </span>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-subtle">Elevation</span>
                        <span className="font-display text-lg font-semibold text-cream">
                          {measurement(environment.elevationM, ' m')}
                          {environment.terrain && (
                            <span className="ml-2 text-sm font-semibold text-muted">{environment.terrain}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {extraMetrics.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm lg:gap-2">
                      {extraMetrics.map((item) => (
                        <Metric key={item.key} icon={item.icon} label={item.label} value={item.value} />
                      ))}
                    </dl>
                  )}
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
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-space-800 px-2.5 py-1.5 lg:px-3 lg:py-2">
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-subtle">
        <Icon name={icon} size={14} className="shrink-0" />
        <span className="min-w-0 wrap-anywhere">{label}</span>
      </dt>
      <dd className="min-w-0 wrap-anywhere text-sm font-bold text-cream tabular-nums">{value}</dd>
    </div>
  )
}
