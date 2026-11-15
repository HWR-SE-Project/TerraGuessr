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
      uvIndex: null,
      sunshineDurationSeconds: null,
      localTime: null,
    }} />);

    expect(screen.getByText('Air pressure')).toBeInTheDocument();
    expect(screen.getByText('Wind direction')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Weather data by Open-Meteo' })).toHaveAttribute('href', 'https://open-meteo.com/');
    screen.getByText('Sun & local time').click();
    expect(screen.getByText('UV index')).toBeInTheDocument();
    expect(screen.getByText('Sunshine today')).toBeInTheDocument();
    expect(screen.getByText('Local time')).toBeInTheDocument();
  });

  it('formats daily sunlight as hours and local timestamp as a compact clock time', () => {
    render(<WeatherPanel weather={{
      temperatureC: 12, precipitationMm: 0, humidityPct: 55, windSpeedKmh: 8,
      airPressureHpa: 1013, windDirectionDeg: 245, uvIndex: 3.1,
      sunshineDurationSeconds: 7200, localTime: '2026-11-17T12:00',
    }} />);
    screen.getByText('Sun & local time', { exact: true }).click();
    expect(screen.getByText('2.0 h')).toBeInTheDocument();
    expect(screen.getByText('12:00', { exact: true })).toBeInTheDocument();
  });
});
