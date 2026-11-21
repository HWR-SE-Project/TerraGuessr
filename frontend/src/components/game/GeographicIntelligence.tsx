import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AdditionalDataAccess, GeographicIntelligence as Intelligence } from '../../lib/contracts'
import { formatPercent } from '../../lib/format'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

type Request =
  | { phase: 'loading' }
  | { phase: 'ready'; data: Intelligence }
  | { phase: 'error' }

function weatherIcon(condition: string | null | undefined): IconName {
  if (condition?.includes('Snow')) return 'snow'
  if (condition && /rain|drizzle|thunderstorm/i.test(condition)) return 'rain'
  if (condition === 'Clear sky' || condition === 'Mainly clear') return 'sun'
  return 'cloud'
}

const metric = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })

function direction(value: number | null | undefined) {
  if (value == null) return '—'
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(value / 45) % 8]
}

/** Collapsible geographic intelligence (weather + environment clues). */
export function GeographicIntelligence({
  load,
  roundId,
  roundKey,
  access = { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
  onUnlock,
  unlocking = false,
  defaultExpanded = true,
}: {
  load: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
  roundId: string
  /** Re-fetch when this changes (e.g. new round/pano). */
  roundKey: string
  access?: AdditionalDataAccess
  onUnlock?: () => void
  unlocking?: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [request, setRequest] = useState<Request>({ phase: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setRequest({ phase: 'loading' })
    load(roundId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRequest({ phase: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setRequest({ phase: 'error' })
      })
    return () => controller.abort()
  }, [load, roundId, roundKey, retry])

  const data = request.phase === 'ready' ? request.data : null
  const weather = data?.weather ?? null
  const environment = data?.environment
  const unlocked = access.unlocked
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
            {request.phase === 'loading'
              ? 'Connecting…'
              : weather
                ? `${metric(weather.temperatureC, 1)}°C${unlocked && weather.condition ? ` · ${weather.condition}` : ''}`
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
              {request.phase === 'loading' ? (
                <p className="py-2 text-sm text-muted">Connecting to the weather station…</p>
              ) : request.phase === 'error' ? (
                <div className="flex flex-col gap-2 py-1">
                  <p className="text-sm text-muted">Signal unavailable. Keep exploring and try again.</p>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-lime-400/15 px-3 py-1.5 text-sm font-bold text-lime-300"
                    onClick={() => {
                      setRequest({ phase: 'loading' })
                      setRetry((r) => r + 1)
                    }}
                  >
                    Retry ↻
                  </button>
                </div>
              ) : (
                <>
                  {canUnlock && (
                    <div className="mb-3 rounded-2xl bg-space-800 p-3">
                      <p className="text-sm text-muted">Weather is visible. Extra clues are locked for this difficulty.</p>
                      <button
                        type="button"
                        disabled={unlocking}
                        onClick={onUnlock}
                        className="mt-2 rounded-full bg-lime-400 px-3 py-1.5 text-sm font-bold text-ink"
                      >
                        {unlocking ? 'Unlocking…' : unlockLabel}
                      </button>
                    </div>
                  )}

                  {/* Weather */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-sky-300">
                      <Icon name={weatherIcon(unlocked ? weather?.condition : null)} size={26} />
                    </span>
                    <div className="flex-1">
                      <span className="font-display text-2xl font-semibold text-cream">
                        {metric(weather?.temperatureC, 1)}°C
                      </span>
                      <span className="ml-2 text-sm font-semibold text-muted">
                        {unlocked ? (weather?.condition ?? 'Conditions unavailable') : 'Conditions locked'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Metric icon="wind" label="Wind" value={unlocked ? `${metric(weather?.windSpeedKmh == null ? null : weather.windSpeedKmh / 3.6, 1)} m/s ${direction(weather?.windDirectionDeg)}` : 'Locked'} />
                    <Metric icon="drop" label="Humidity" value={unlocked ? formatPercent(weather?.humidityPct) : 'Locked'} />
                    {unlocked && (
                      <>
                        <Metric icon="pressure" label="Pressure" value={`${metric(weather?.pressureHpa)} hPa`} />
                        <Metric icon="rain" label="Rain" value={weather?.precipitationMm ? `${metric(weather.precipitationMm, 1)} mm` : 'None'} />
                      </>
                    )}
                  </div>

                  {unlocked && environment?.elevationM != null && (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-space-800 p-3">
                      <span className="text-lime-300">
                        <Icon name="mountain" size={20} />
                      </span>
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-subtle">Elevation</span>
                        <span className="font-display text-lg font-semibold text-cream">
                          {metric(environment.elevationM)} m
                          <span className="ml-2 text-sm font-semibold text-muted">{environment.terrain}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </>
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
    <div className="flex items-center gap-2 rounded-xl bg-space-800 px-3 py-2">
      <Icon name={icon} size={16} className="shrink-0 text-subtle" />
      <span className="min-w-0 flex-1 truncate text-xs text-subtle">{label}</span>
      <span className="shrink-0 text-sm font-bold text-cream">{value}</span>
    </div>
  )
}
