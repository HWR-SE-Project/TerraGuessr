import { Button } from '../components/ui/Button'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type {
  GeographicIntelligence as Intelligence,
  StreetRound,
} from '../api/singleplayer'
import type { AdditionalDataAccessDTO } from '../api/types'
import { GeoIcon } from './GeoIcon'
import type { GeoIconName } from './GeoIcon'
import { duration, ease, staggerContainer, staggerItem } from '../lib/motion'
import './GeographicIntelligence.css'

/** Expand/collapse for the always-mounted (inert-when-closed) content region. */
const giContentVariants = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: { duration: duration.base, ease: ease.emphasized },
  },
}

const metric = (value: number | null | undefined, digits = 0) =>
  value == null
    ? '—'
    : value.toLocaleString(undefined, { maximumFractionDigits: digits })
function weatherIcon(condition: string | null | undefined): GeoIconName {
  if (condition?.includes('Snow')) return 'snow'
  if (condition && /rain|drizzle|Thunderstorm/i.test(condition)) return 'rain'
  if (condition === 'Clear sky' || condition === 'Mainly clear') return 'sun'
  return 'cloud'
}
function direction(value: number | null | undefined) {
  return value == null
    ? ''
    : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(value / 45) % 8]
}

export function GeographicIntelligence({
  load,
  round,
  defaultExpanded = true,
  tutorialFocused = false,
  access = { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 },
  onUnlock,
  unlocking = false,
  unlockError = null,
}: {
  load: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
  round: StreetRound
  /** Optional user preference for the initial expanded state. The mandatory
   * weather fields (R06) are always rendered; collapsing only hides them on
   * request. */
  defaultExpanded?: boolean
  /** Temporarily reveal the real panel without changing the player's preference. */
  tutorialFocused?: boolean
  /** R05 additional-data gate. Defaults to free access for direct usage. */
  access?: AdditionalDataAccessDTO
  onUnlock?: () => void
  unlocking?: boolean
  unlockError?: string | null
}) {
  const unlocked = access.unlocked
  const unlockLabel =
    access.mode === 'points'
      ? `Unlock · −${access.cost ?? 0} points`
      : access.mode === 'time'
        ? `Unlock · −${access.cost ?? 0} seconds`
        : 'Unlock additional data'

  const [expanded, setExpanded] = useState(defaultExpanded)
  const isExpanded = tutorialFocused || expanded
  const [request, setRequest] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; data: Intelligence }
    | { phase: 'error' }
  >({ phase: 'loading' })
  const [retry, setRetry] = useState(0)
  const data = request.phase === 'ready' ? request.data : null
  const loading = request.phase === 'loading'
  const failed = request.phase === 'error'
  useEffect(() => {
    const controller = new AbortController()
    load(round.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setRequest({ phase: 'ready', data: value })
      })
      .catch(() => {
        if (!controller.signal.aborted) setRequest({ phase: 'error' })
      })
    return () => controller.abort()
  }, [load, round.id, round.panoId, retry])
  const weather = data?.weather
  const environment = data?.environment
  const modelTime = weather?.modelTime ? new Date(weather.modelTime) : null
  const timeLabel =
    modelTime && Number.isFinite(modelTime.getTime())
      ? modelTime.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
      : null
  function retryRequest() {
    setRequest({ phase: 'loading' })
    setRetry((value) => value + 1)
  }
  const unavailable =
    failed || (!loading && !weather && environment?.elevationM == null)

  return (
    <aside
      className={`gi-panel tg-glass tg-glass--panel${isExpanded ? '' : ' gi-panel-collapsed'}`}
      aria-label="Geographic intelligence"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          event.stopPropagation()
          setExpanded(false)
        }
      }}
    >
      <button
        className="gi-header"
        aria-expanded={isExpanded}
        aria-controls="gi-content"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="gi-header-icon">
          <GeoIcon name="scan" />
        </span>
        <span>
          <strong>
            GEOGRAPHIC
            <br /> INTELLIGENCE
          </strong>
          <small>
            {loading
              ? 'Connecting…'
              : weather
                ? `${metric(weather.temperatureC, 1)}°C${unlocked && weather.condition ? ` · ${weather.condition}` : ''}`
                : 'Environmental clues'}
          </small>
        </span>
        <GeoIcon name="chevron" />
      </button>
      <motion.div
        className="gi-desktop-content"
        id="gi-content"
        inert={!isExpanded}
        initial={false}
        animate={isExpanded ? 'animate' : 'initial'}
        variants={giContentVariants}
      >
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate={isExpanded ? 'animate' : 'initial'}
        >
          {loading ? (
            <p className="gi-loading" role="status">
              <span className="sp-spinner" /> Connecting to the weather station…
            </p>
          ) : unavailable ? (
            <div className="gi-unavailable" role="status">
              <GeoIcon name="scan" />
              <strong>Signal unavailable</strong>
              <p>
                Environmental data couldn’t be retrieved. Keep exploring and try
                again.
              </p>
              <Button variant="tinted" onClick={retryRequest}>
                Retry connection <span aria-hidden="true">↻</span>
              </Button>
            </div>
          ) : (
            <>
              {!unlocked && (
                <div className="gi-unlock" role="status">
                  <p>
                    Mandatory weather is visible. Additional metrics and
                    environment clues are locked for this difficulty.
                  </p>
                  <button
                    type="button"
                    className="tg-control"
                    disabled={unlocking || !onUnlock}
                    onClick={onUnlock}
                  >
                    {unlocking ? 'Unlocking…' : unlockLabel}
                  </button>
                  {unlockError && (
                    <p role="alert" className="gi-hint">
                      {unlockError}
                    </p>
                  )}
                </div>
              )}
              {unlocked && access.mode === 'points' && access.pointsSpent > 0 && (
                <p className="gi-hint" role="status">
                  Additional data unlocked · −{access.pointsSpent} points from
                  this round.
                </p>
              )}
              {unlocked && access.mode === 'time' && access.cost !== null && (
                <p className="gi-hint" role="status">
                  Additional data unlocked · −{access.cost} seconds on this
                  round.
                </p>
              )}
              <motion.section className="gi-weather" aria-label="Weather conditions" variants={staggerItem}>
                <div className="gi-section-label">
                  <h3>Weather</h3>
                </div>
                <div className="gi-temperature">
                  <div className="gi-temperature-reading">
                    <span className="gi-temperature-label">Temperature</span>
                    <div className="gi-temperature-value">
                      <strong>{metric(weather?.temperatureC, 1)}</strong>
                      <span>°C</span>
                    </div>
                  </div>
                  <div className="gi-weather-symbol">
                    <GeoIcon name={weatherIcon(unlocked ? weather?.condition : null)} />
                  </div>
                </div>
                <div className="gi-condition">
                  {unlocked
                    ? (weather?.condition ?? 'Conditions unavailable')
                    : 'Additional data locked'}
                  <span>Current conditions</span>
                </div>
                <div className="gi-metrics">
                  <div title="Wind at 10 m. Direction indicates where the wind comes from.">
                    <GeoIcon name="wind" />
                    <span>Wind speed</span>
                    <strong>
                      {metric(weather?.windSpeedKmh == null ? null : weather.windSpeedKmh / 3.6, 1)}
                      <small> m/s</small>
                    </strong>
                    <em>
                      {unlocked
                        ? direction(weather?.windDirectionDeg) || 'Unavailable'
                        : 'Locked'}
                    </em>
                  </div>
                  <div title="Relative humidity at 2 m above ground.">
                    <GeoIcon name="drop" />
                    <span>Humidity</span>
                    <strong>
                      {metric(weather?.humidityPct)}
                      <small>%</small>
                    </strong>
                  </div>
                  {unlocked && (
                    <div title="Atmospheric pressure at the surface, not adjusted to sea level.">
                      <GeoIcon name="pressure" />
                      <span>Pressure</span>
                      <strong>
                        {metric(weather?.pressureHpa)}
                        <small> hPa</small>
                      </strong>
                      <em>At surface</em>
                    </div>
                  )}
                </div>
                <div className="gi-precipitation">
                  <GeoIcon name="rain" />
                  <span>
                    Precipitation
                    {weather?.precipitationIntervalMinutes != null && (
                      <small>
                        {' '}
                        · {metric(weather.precipitationIntervalMinutes)} min
                      </small>
                    )}
                  </span>
                  <strong>
                    {metric(weather?.precipitationMm, 2)} <small>mm</small>
                  </strong>
                </div>
                {!weather && (
                  <p className="gi-hint">Weather is temporarily unavailable.</p>
                )}
              </motion.section>
              {unlocked && (
                <motion.section className="gi-environment" aria-label="Environment" variants={staggerItem}>
                  <div className="gi-section-label">
                    <h3>Environment</h3>
                    <span>GROUND PROFILE</span>
                  </div>
                  <div className="gi-elevation">
                    <div className="gi-elevation-icon">
                      <GeoIcon name="mountain" />
                    </div>
                    <div>
                      <span>Elevation</span>
                      <strong>
                        {metric(environment?.elevationM)} <small>m</small>
                      </strong>
                    </div>
                    <span className="gi-elevation-note">
                      above
                      <br />
                      sea level
                    </span>
                  </div>
                  <p className="gi-hint">
                    Terrain: {environment?.terrain ?? 'unavailable'}
                    {environment?.terrain && ' (estimated)'}
                    {environment?.reliefM != null &&
                      ` · ${metric(environment.reliefM)} m sampled relief across ~2 km`}
                  </p>
                </motion.section>
              )}
            </>
          )}
          <footer className="gi-footer">
            <div>
              <span className="gi-signal-dot" />
              {weather
                ? `${data?.cached ? 'Cached model' : 'Weather model'}${timeLabel ? ` · ${timeLabel}` : ' · time unavailable'}`
                : 'Weather data unavailable'}
            </div>
            <div className="gi-attribution">
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>
              <span> · </span>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </aside>
  )
}
