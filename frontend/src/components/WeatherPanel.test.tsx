import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherPanel } from './WeatherPanel';

describe('WeatherPanel optional provider fields', () => {
  it('shows unavailable values explicitly and attributes Open-Meteo', () => {
    render(<WeatherPanel weather={{
      temperatureC: 12,
      precipitationMm: 0,
      humidityPct: 55,
      windSpeedKmh: 8,
      airPressureHpa: null,
      windDirectionDeg: null,
    }} />);

    expect(screen.getByText('Air pressure')).toBeInTheDocument();
    expect(screen.getByText('Wind direction')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Weather data by Open-Meteo' })).toHaveAttribute('href', 'https://open-meteo.com/');
  });
});
