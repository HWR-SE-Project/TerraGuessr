import type { WeatherDTO } from '../api/types';

// R15 — exactly these four fields, always in this fixed order, with fixed labels
// and units. The order/labels/units never change between renders.
const WEATHER_FIELDS = [
  { key: 'temperatureC', label: 'Temperature', unit: ' °C' },
  { key: 'precipitationMm', label: 'Precipitation', unit: ' mm' },
  { key: 'humidityPct', label: 'Humidity', unit: '%' },
  { key: 'windSpeedKmh', label: 'Wind speed', unit: ' km/h' },
] as const;

export interface WeatherPanelProps {
  weather: WeatherDTO;
}

export function WeatherPanel({ weather }: WeatherPanelProps) {
  return (
    <section aria-labelledby="weather-heading" data-testid="weather-panel" className="tg-hud">
      <div className="tg-eyebrow">Field intelligence</div>
      <h2 id="weather-heading" className="tg-hud-title">Weather conditions</h2>
      <p className="tg-hud-subtitle">Latest available · Open-Meteo</p>
      <dl className="tg-weather-grid">
        {WEATHER_FIELDS.map(({ key, label, unit }) => (
          <div key={key} className="tg-weather-cell">
            <dt className="tg-weather-label">{label}<span className="tg-weather-icon" aria-hidden="true">{key === 'temperatureC' ? '☼' : key === 'precipitationMm' ? '⌁' : key === 'humidityPct' ? '◌' : '↗'}</span></dt>
            <dd className="tg-weather-value" style={{ margin: 0 }}>{weather[key]}{unit}</dd>
          </div>
        ))}
      </dl>
      <p className="tg-attribution">Weather data is cached for up to one hour. Measurements may be unavailable for some locations.</p>
    </section>
  );
}

export default WeatherPanel;
