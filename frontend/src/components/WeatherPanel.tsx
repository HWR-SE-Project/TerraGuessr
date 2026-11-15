import { useEffect, useState } from 'react';
import type { AdditionalDataAccessDTO, WeatherDTO } from '../api/types';

// R15 — exactly these four fields, always in this fixed order, with fixed labels
// and units. The order/labels/units never change between renders.
const WEATHER_FIELDS = [
  { key: 'temperatureC', label: 'Temperature', unit: ' °C' },
  { key: 'precipitationMm', label: 'Precipitation', unit: ' mm' },
  { key: 'humidityPct', label: 'Humidity', unit: '%' },
  { key: 'windSpeedKmh', label: 'Wind speed', unit: ' km/h' },
  { key: 'airPressureHpa', label: 'Air pressure', unit: ' hPa' },
  { key: 'windDirectionDeg', label: 'Wind direction', unit: '°' },
] as const;
const SKY_FIELDS = [
  { key: 'uvIndex', label: 'UV index', unit: '' },
  { key: 'sunshineDurationSeconds', label: 'Sunshine today', unit: '' },
  { key: 'localTime', label: 'Local time', unit: '' },
] as const;

export interface WeatherPanelProps {
  weather: WeatherDTO;
  access?: AdditionalDataAccessDTO;
  unlocking?: boolean;
  unlockError?: string | null;
  onUnlock?: () => void;
}

export function WeatherPanel({ weather, access = { mode: 'immediate', cost: null, availableAt: null, unlocked: true }, unlocking = false, unlockError, onUnlock }: WeatherPanelProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (access.mode !== 'time' || access.unlocked || !access.availableAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [access.mode, access.unlocked, access.availableAt]);
  const secondsLeft = access.mode === 'time' && access.availableAt ? Math.max(0, Math.ceil((new Date(access.availableAt).getTime() - now) / 1000)) : 0;
  return (
    <section aria-labelledby="weather-heading" data-testid="weather-panel" className="tg-hud">
      <div className="tg-eyebrow">Field intelligence</div>
      <h2 id="weather-heading" className="tg-hud-title">Weather conditions</h2>
      <p className="tg-hud-subtitle">Latest available · Open-Meteo</p>
      <dl className="tg-weather-grid">
        {WEATHER_FIELDS.map(({ key, label, unit }) => (
          <div key={key} className="tg-weather-cell">
            <dt className="tg-weather-label" data-icon={key === 'temperatureC' ? '☼' : key === 'precipitationMm' ? '⌁' : key === 'humidityPct' ? '◌' : '↗'}>{label}</dt>
            <dd className="tg-weather-value">{weather[key] == null ? '—' : `${weather[key]}${unit}`}</dd>
          </div>
        ))}
      </dl>
      <details className="tg-weather-extra">
        <summary>Sun &amp; local time</summary>
        {!access.unlocked ? <div className="tg-weather-lock">
          <p>{access.mode === 'time' ? `Additional clues unlock in ${secondsLeft}s.` : `Unlock for ${access.cost?.toLocaleString() ?? 0} points. The cost is deducted from this round’s score.`}</p>
          <button type="button" className="tg-button tg-button-secondary" disabled={unlocking || secondsLeft > 0 || !onUnlock} onClick={onUnlock}>{unlocking ? 'Unlocking…' : access.mode === 'time' && secondsLeft > 0 ? `Available in ${secondsLeft}s` : access.mode === 'points' ? `Unlock · −${access.cost?.toLocaleString() ?? 0} pts` : 'Unlock clues'}</button>
          {unlockError ? <p role="alert" className="tg-error">{unlockError}</p> : null}
        </div> : null}
        <dl className="tg-weather-grid tg-weather-extra-grid">
          {SKY_FIELDS.map(({ key, label }) => {
            const value = weather[key];
            const formatted = value == null ? '—' : key === 'sunshineDurationSeconds'
              ? `${(Number(value) / 3600).toFixed(1)} h`
              : key === 'uvIndex' ? Number(value).toFixed(1)
                : key === 'localTime' ? (String(value).match(/T(\d{2}:\d{2})/)?.[1] ?? String(value))
                  : String(value);
            return <div key={key} className="tg-weather-cell"><dt className="tg-weather-label">{label}</dt><dd className="tg-weather-value">{formatted}</dd></div>;
          })}
        </dl>
      </details>
      <p className="tg-attribution">Cached for up to one hour. Optional measurements may be unavailable. <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a>.</p>
    </section>
  );
}

export default WeatherPanel;
