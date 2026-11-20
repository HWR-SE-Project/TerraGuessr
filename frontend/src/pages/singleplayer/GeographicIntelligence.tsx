import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type {
  GeographicIntelligence as Intelligence,
  StreetRound,
} from '../../api/singleplayer'
import { GameDialog } from './GameDialog'
import './GeographicIntelligence.css'

type IconName =
  | 'scan'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'wind'
  | 'drop'
  | 'pressure'
  | 'mountain'
  | 'leaf'
  | 'chevron'
  | 'info'
  | 'climate'
function GeoIcon({ name, style }: { name: IconName; style?: CSSProperties }) {
  const paths: Record<IconName, ReactNode> = {
    scan: (
      <>
        <circle cx="12" cy="12" r="7" />
        <ellipse cx="12" cy="12" rx="3" ry="7" />
        <path d="M5 12h14M12 2v2m0 16v2M2 12h2m16 0h2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
      </>
    ),
    cloud: (
      <>
        <path d="M6 18a4 4 0 0 1-1-7.9A6 6 0 0 1 16.7 9 4.5 4.5 0 1 1 18 18Z" />
        <path d="M5 5 4 4m6-1V2M2 9H1" />
      </>
    ),
    rain: (
      <>
        <path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 2 9M8 17l-1 3m6-3-1 3m6-3-1 3" />
      </>
    ),
    snow: (
      <>
        <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 5l3 3 3-3M9 19l3-3 3 3" />
      </>
    ),
    wind: (
      <>
        <path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3" />
      </>
    ),
    drop: (
      <path d="M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Zm-3 13a3 3 0 0 0 3 3" />
    ),
    pressure: (
      <>
        <path d="M5 19a9 9 0 1 1 14 0M12 3v2M5 7l2 2m12-2-2 2M3 13h2m14 0h2M12 13l4-5" />
        <circle cx="12" cy="13" r="1.5" />
        <path d="M9 20h6" />
      </>
    ),
    mountain: (
      <>
        <path d="m2 20 8-15 5 9 3-5 5 11ZM7 11l3 2 3-2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C6 2 2 9 6 16s15 1 14-13ZM4 21 16 9M9 16v-5m0 5h5" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.2" />
      </>
    ),
    climate: (
      <>
        <path d="M14 14.5V5a3 3 0 0 0-6 0v9.5a5 5 0 1 0 6 0ZM11 8v10m7-12h3m-3 4h2" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  )
}
const metric = (value: number | null | undefined, digits = 0) =>
  value == null
    ? '—'
    : value.toLocaleString(undefined, { maximumFractionDigits: digits })
function weatherIcon(condition: string | null | undefined): IconName {
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
}: {
  load: (roundId: string, signal?: AbortSignal) => Promise<Intelligence>
  round: StreetRound
  /** Hard difficulty starts this collapsed — a real but non-misleading
   * difficulty lever; the four mandatory fields remain fully available on
   * demand (R05). */
  defaultExpanded?: boolean
  /** Temporarily reveal the real panel without changing the player’s preference. */
  tutorialFocused?: boolean
}) {
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
              <button className="tg-control tg-control--tinted" onClick={retryRequest}>
                Retry connection <span aria-hidden="true">↻</span>
              </button>
            </div>
          )}
          {!unavailable && (
            <>
              <section className="gi-weather" aria-label="Weather conditions">
                <div className="gi-section-label">
                  <h3>Weather</h3>
                  <span>MODEL ESTIMATE</span>
                </div>
                <div className="gi-temperature">
                  <div>
                    <strong>{metric(weather?.temperatureC, 1)}</strong>
                    <span>°C</span>
                  </div>
                  <div className="gi-weather-symbol">
                    <GeoIcon name={weatherIcon(weather?.condition)} />
                  </div>
                </div>
                <div className="gi-condition">
                  {weather?.condition ?? 'Conditions unavailable'}
                  <span>Current conditions</span>
                </div>
                <div className="gi-metrics">
                  <div title="Wind at 10 m. Direction indicates where the wind comes from.">
                    <GeoIcon name="wind" />
                    <span>Wind</span>
                    <strong>
                      {metric(weather?.windSpeedKmh == null ? null : weather.windSpeedKmh / 3.6, 1)}
                      <small> m/s</small>
                    </strong>
                    <em>
                      {weather?.windDirectionDeg != null && (
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
                      {direction(weather?.windDirectionDeg) || 'Unavailable'}
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
                  <div title="Atmospheric pressure at the surface, not adjusted to sea level.">
                    <GeoIcon name="pressure" />
                    <span>Pressure</span>
                    <strong>
                      {metric(weather?.pressureHpa)}
                      <small> hPa</small>
                    </strong>
                    <em>At surface</em>
                  </div>
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
            <p>Model weather; Street View imagery may be older.</p>
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
        className={`gi-panel${isExpanded ? '' : ' gi-panel-collapsed'}`}
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
              {isExpanded
                ? 'READ THE WORLD AROUND YOU'
                : loading
                  ? 'Connecting…'
                  : weather
                    ? `${metric(weather.temperatureC, 1)}°C · ${weather.condition ?? 'Weather'}`
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
        <span>Geo intel</span>
        <span className="gi-signal-dot" />
      </button>
      {mobileOpen &&
        createPortal(
          <GameDialog
            title="Geographic intelligence"
            onClose={() => {
              setMobileOpen(false)
              trigger.current?.focus()
            }}
            className="gi-sheet"
          >
            <span className="gi-sheet-eyebrow">READ THE WORLD AROUND YOU</span>
            {body('gi-mobile')}
          </GameDialog>,
          document.body,
        )}
    </>
  )
}
