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
    <section aria-labelledby="weather-heading" data-testid="weather-panel">
      <h2 id="weather-heading">Weather</h2>
      <dl>
        {WEATHER_FIELDS.map(({ key, label, unit }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {weather[key]}
              {unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default WeatherPanel;
