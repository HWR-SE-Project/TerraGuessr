import { useEffect, useState } from 'react'
import type { AdditionalDataAccessDTO, WeatherDTO } from '../api/types'
import { ClockIcon, CompassIcon, HumidityIcon, PrecipitationIcon, PressureIcon, SunshineIcon, TemperatureIcon, UVIcon, WindIcon } from './icons'
import './WeatherPanel.css'

const WEATHER_FIELDS = [
  { key: 'temperatureC', label: 'Temperature', unit: ' °C', Icon: TemperatureIcon },
  { key: 'precipitationMm', label: 'Precipitation', unit: ' mm', Icon: PrecipitationIcon },
  { key: 'humidityPct', label: 'Humidity', unit: '%', Icon: HumidityIcon },
  { key: 'windSpeedKmh', label: 'Wind speed', unit: ' km/h', Icon: WindIcon },
] as const

const EXTRA_FIELDS = [
  { key: 'airPressureHpa', label: 'Air pressure', unit: ' hPa', Icon: PressureIcon },
  { key: 'windDirectionDeg', label: 'Wind direction', unit: '°', Icon: CompassIcon },
  { key: 'uvIndex', label: 'UV index', unit: '', Icon: UVIcon },
  { key: 'sunshineDurationSeconds', label: 'Sunshine today', unit: '', Icon: SunshineIcon },
  { key: 'localTime', label: 'Local time', unit: '', Icon: ClockIcon },
] as const

export interface WeatherPanelProps {
  weather: WeatherDTO
  access?: AdditionalDataAccessDTO
  unlocking?: boolean
  unlockError?: string | null
  onUnlock?: () => void
}

function formatExtra(key: string, value: number | string | null): string {
  if (value == null) return '—'
  if (key === 'sunshineDurationSeconds') return `${(Number(value) / 3600).toFixed(1)} h`
  if (key === 'uvIndex') return Number(value).toFixed(1)
  if (key === 'localTime') return String(value).match(/T(\d{2}:\d{2})/)?.[1] ?? String(value)
  return String(value)
}

export function WeatherPanel({
  weather,
  access = { mode: 'immediate', cost: null, availableAt: null, unlocked: true },
  unlocking = false,
  unlockError,
  onUnlock,
}: WeatherPanelProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (access.mode !== 'time' || access.unlocked || !access.availableAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [access.mode, access.unlocked, access.availableAt])

  const secondsLeft = access.mode === 'time' && access.availableAt ? Math.max(0, Math.ceil((new Date(access.availableAt).getTime() - now) / 1000)) : 0

  return (
    <section aria-labelledby="weather-heading" data-testid="weather-panel" className="tg-weather">
      <div className="tg-weather-eyebrow">Field intelligence</div>
      <h2 id="weather-heading" className="tg-weather-title">Weather conditions</h2>
      <dl className="tg-weather-grid">
        {WEATHER_FIELDS.map(({ key, label, unit, Icon }) => (
          <div key={key} className="tg-weather-cell">
            <dt className="tg-weather-label">
              <span className="tg-weather-icon"><Icon /></span>
              {label}
            </dt>
            <dd className="tg-weather-value">{weather[key] == null ? '—' : `${weather[key]}${unit}`}</dd>
          </div>
        ))}
      </dl>

      <details className="tg-weather-extra">
        <summary>Sun &amp; local time</summary>
        {!access.unlocked && (
          <div className="tg-weather-lock">
            <p>
              {access.mode === 'time'
                ? `Additional clues unlock in ${secondsLeft}s.`
                : `Unlock for ${access.cost?.toLocaleString() ?? 0} points — deducted from this round's score.`}
            </p>
            <button
              type="button"
              className="tg-weather-unlock-btn tg-control"
              disabled={unlocking || secondsLeft > 0 || !onUnlock}
              onClick={onUnlock}
            >
              {unlocking ? 'Unlocking…' : access.mode === 'time' && secondsLeft > 0 ? `Available in ${secondsLeft}s` : access.mode === 'points' ? `Unlock · −${access.cost?.toLocaleString() ?? 0} pts` : 'Unlock clues'}
            </button>
            {unlockError && <p role="alert" className="tg-weather-error">{unlockError}</p>}
          </div>
        )}
        <dl className="tg-weather-grid tg-weather-extra-grid">
          {EXTRA_FIELDS.map(({ key, label, unit, Icon }) => (
            <div key={key} className="tg-weather-cell">
              <dt className="tg-weather-label">
                <span className="tg-weather-icon"><Icon /></span>
                {label}
              </dt>
              <dd className="tg-weather-value">{access.unlocked ? `${formatExtra(key, weather[key])}${weather[key] != null ? unit : ''}` : '—'}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="tg-weather-attribution">
        Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        .
      </p>
    </section>
  )
}
