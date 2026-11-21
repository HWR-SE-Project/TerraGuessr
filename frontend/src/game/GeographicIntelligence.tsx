import { Button } from '../components/ui/Button'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  GeographicIntelligence as Intelligence,
  StreetRound,
} from '../api/singleplayer'
import type { AdditionalDataAccessDTO } from '../api/types'
import { Modal } from '../components/ui/Modal'
import { GeoIcon } from './GeoIcon'
import type { GeoIconName } from './GeoIcon'
import './GeographicIntelligence.css'

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
  /** Optional user preference for the initial expanded state. The four
   * mandatory weather fields are always rendered (R06/R15); collapsing only
   * hides them on request. */
  defaultExpanded?: boolean
  /** Temporarily reveal the real panel without changing the player’s preference. */
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [climateOpen, setClimateOpen] = useState(false)
  const [data, setData] = useState<Intelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const desktopToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    load(round.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value)
          setFailed(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [load, round.id, round.panoId, retry])
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)')
    const close = () => {
      if (!query.matches) setMobileOpen(false)
    }
    query.addEventListener('change', close)
    return () => query.removeEventListener('change', close)
  }, [])
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
    setLoading(true)
    setFailed(false)
    setData(null)
    setRetry((value) => value + 1)
  }
  const unavailable =
    failed || (!loading && !weather && environment?.elevationM == null)
  const body = (prefix: string) => (
    <>
      {loading ? (
        <div
          className="gi-skeleton"
          role="status"
          aria-label="Loading geographic intelligence"
        >
          <span />
          <b />
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
          <span />
          <span />
        </div>
      ) : (
        <>
          {unavailable && (
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
          )}
          {!unavailable && (
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
              <section className="gi-weather" aria-label="Weather conditions">
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
                      {unlocked && weather?.windDirectionDeg != null && (
                        <span
                          className="gi-wind-arrow"
                          style={{
                            transform: `rotate(${weather.windDirectionDeg + 180}deg)`,
                          }}
                          aria-hidden="true"
                        >
                          ↑
                        </span>
                      )}
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
                    <span
                      className="gi-humidity"
                      role="meter"
                      aria-label="Relative humidity"
                      aria-valuenow={weather?.humidityPct ?? undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={
                        weather?.humidityPct == null
                          ? 'Unavailable'
                          : `${weather.humidityPct}%`
                      }
                    >
                      <i style={{ width: `${weather?.humidityPct ?? 0}%` }} />
                    </span>
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
              </section>
              {unlocked && (
                <section className="gi-environment" aria-label="Environment">
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
                  <dl className="gi-environment-list">
                    <div>
                      <dt>
                        <GeoIcon name="mountain" />
                        Terrain
                      </dt>
                      <dd>
                        {environment?.terrain ?? 'Unavailable'}
                        {environment?.terrain && (
                          <span className="gi-estimated">EST.</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <GeoIcon name="leaf" />
                        Biome
                      </dt>
                      <dd className="gi-missing">Not available</dd>
                    </div>
                  </dl>
                  {environment?.reliefM != null && (
                    <p className="gi-hint">
                      {metric(environment.reliefM)} m sampled relief across ~2 km.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
          <section
            className={`gi-climate${climateOpen ? ' gi-climate-open' : ''}`}
            aria-label="Long-term climate"
          >
            <button
              aria-expanded={climateOpen}
              aria-controls={`${prefix}-climate-details`}
              onClick={() => setClimateOpen(!climateOpen)}
            >
              <GeoIcon name="climate" />
              <span>
                Climate normals <small>LONG-TERM AVERAGES</small>
              </span>
              <GeoIcon name="chevron" />
            </button>
            <div id={`${prefix}-climate-details`} hidden={!climateOpen}>
              <p>
                Climate classification, typical temperatures and annual rainfall
                are unavailable. No verified climate or biome dataset is
                connected.
              </p>
              <p>Current weather does not determine climate or vegetation.</p>
            </div>
          </section>
          <footer className="gi-footer">
            <div>
              <span className="gi-signal-dot" />
              {weather
                ? `${data?.cached ? 'Cached model' : 'Weather model'}${timeLabel ? ` · ${timeLabel}` : ' · time unavailable'}`
                : 'Weather data unavailable'}
            </div>
            <div className="gi-attribution">
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo
              </a>
              <span> / </span>
              <a
                href="https://open-meteo.com/en/docs/elevation-api"
                target="_blank"
                rel="noreferrer"
              >
                Copernicus DEM
              </a>
              <span> · </span>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              <button
                className="gi-info"
                aria-label="About environmental data"
                aria-expanded={notesOpen}
                aria-controls={`${prefix}-data-notes`}
                onClick={() => setNotesOpen(!notesOpen)}
                title="Weather is model-based. Elevation uses a 90 m digital surface model; buildings and vegetation can affect it. Terrain is an estimate from nine elevation samples, not a landform classification."
              >
                <GeoIcon name="info" />
              </button>
            </div>
            <div
              id={`${prefix}-data-notes`}
              className="gi-data-notes"
              hidden={!notesOpen}
            >
              <p>
                Weather is a model estimate, not a station observation.
                Elevation uses the 90 m Copernicus digital surface model and may
                include buildings or vegetation. Terrain describes relief
                sampled at nine points across ~2 km: low (&lt;50 m), rolling
                (50–199 m), or high (≥200 m). It is not a landform
                classification.
              </p>
              <p>
                Weather is cached for 15 minutes; elevation for 30 days. Biome,
                vegetation and climate averages require a separate verified
                dataset.
              </p>
            </div>
          </footer>
        </>
      )}
    </>
  )
  return (
    <>
      <aside
        className={`gi-panel tg-glass tg-glass--panel${isExpanded ? '' : ' gi-panel-collapsed'}`}
        aria-label="Geographic intelligence"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setExpanded(false)
            desktopToggle.current?.focus()
          }
        }}
      >
        <button
          ref={desktopToggle}
          className="gi-header"
          aria-expanded={isExpanded}
          aria-controls="gi-desktop-content"
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
        <div
          className="gi-desktop-content"
          id="gi-desktop-content"
          inert={!isExpanded}
        >
          <div>{body('gi-desktop')}</div>
        </div>
      </aside>
      <button
        ref={trigger}
        className="gi-mobile-trigger tg-control"
        aria-label="Open geographic intelligence"
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <GeoIcon name="scan" />
        <span className="gi-mobile-trigger-label">
          {weather ? (
            <>
              <span className="gi-mobile-metric">
                <b>Temperature</b>
                <span>{metric(weather.temperatureC, 1)} °C</span>
              </span>
              <span className="gi-mobile-metric">
                <b>Wind speed</b>
                <span>
                  {metric(
                    weather.windSpeedKmh == null
                      ? null
                      : weather.windSpeedKmh / 3.6,
                    1,
                  )}{' '}
                  m/s
                </span>
              </span>
              <span className="gi-mobile-metric">
                <b>Humidity</b>
                <span>{metric(weather.humidityPct)} %</span>
              </span>
              <span className="gi-mobile-metric">
                <b>Precipitation</b>
                <span>{metric(weather.precipitationMm, 2)} mm</span>
              </span>
            </>
          ) : (
            <span>Geo intel</span>
          )}
        </span>
        <span className="gi-signal-dot" />
      </button>
      {mobileOpen &&
        createPortal(
          <Modal
            title="Geographic intelligence"
            onClose={() => {
              setMobileOpen(false)
              trigger.current?.focus()
            }}
            className="gi-sheet"
          >
            {body('gi-mobile')}
          </Modal>,
          document.body,
        )}
    </>
  )
}
