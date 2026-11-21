import type { WeatherCondition } from '../../lib/contracts'

// Mock geography: a small catalogue of real, Street-View-covered places used
// to power Phase 1 gameplay. In Phase 2 the backend generates rounds server-side
// and the client never sees the answer coordinates until a guess is submitted.

export interface MockLocation {
  id: string
  name: string
  region: string
  country: string
  lat: number
  lon: number
  hemisphere: 'north' | 'south'
  climate: 'temperate' | 'tropical' | 'arid' | 'cold'
  elevationM: number
  relief: 'Low relief' | 'Rolling relief' | 'High relief'
}

export const LOCATIONS: MockLocation[] = [
  { id: 'paris', name: 'Paris', region: 'Île-de-France', country: 'France', lat: 48.8584, lon: 2.2945, hemisphere: 'north', climate: 'temperate', elevationM: 35, relief: 'Low relief' },
  { id: 'london', name: 'London', region: 'England', country: 'United Kingdom', lat: 51.5007, lon: -0.1246, hemisphere: 'north', climate: 'temperate', elevationM: 11, relief: 'Low relief' },
  { id: 'amsterdam', name: 'Amsterdam', region: 'North Holland', country: 'Netherlands', lat: 52.3676, lon: 4.9041, hemisphere: 'north', climate: 'temperate', elevationM: -2, relief: 'Low relief' },
  { id: 'barcelona', name: 'Barcelona', region: 'Catalonia', country: 'Spain', lat: 41.3851, lon: 2.1734, hemisphere: 'north', climate: 'temperate', elevationM: 12, relief: 'Low relief' },
  { id: 'rome', name: 'Rome', region: 'Lazio', country: 'Italy', lat: 41.9028, lon: 12.4964, hemisphere: 'north', climate: 'temperate', elevationM: 21, relief: 'Rolling relief' },
  { id: 'berlin', name: 'Berlin', region: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, hemisphere: 'north', climate: 'temperate', elevationM: 34, relief: 'Low relief' },
  { id: 'newyork', name: 'New York', region: 'New York', country: 'United States', lat: 40.758, lon: -73.9855, hemisphere: 'north', climate: 'temperate', elevationM: 10, relief: 'Low relief' },
  { id: 'mexico', name: 'Mexico City', region: 'CDMX', country: 'Mexico', lat: 19.4326, lon: -99.1332, hemisphere: 'north', climate: 'temperate', elevationM: 2240, relief: 'High relief' },
  { id: 'rio', name: 'Rio de Janeiro', region: 'Rio de Janeiro', country: 'Brazil', lat: -22.9707, lon: -43.1825, hemisphere: 'south', climate: 'tropical', elevationM: 5, relief: 'High relief' },
  { id: 'buenosaires', name: 'Buenos Aires', region: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816, hemisphere: 'south', climate: 'temperate', elevationM: 25, relief: 'Low relief' },
  { id: 'capetown', name: 'Cape Town', region: 'Western Cape', country: 'South Africa', lat: -33.9249, lon: 18.4241, hemisphere: 'south', climate: 'temperate', elevationM: 25, relief: 'High relief' },
  { id: 'cairo', name: 'Cairo', region: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357, hemisphere: 'north', climate: 'arid', elevationM: 23, relief: 'Low relief' },
  { id: 'dubai', name: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708, hemisphere: 'north', climate: 'arid', elevationM: 16, relief: 'Low relief' },
  { id: 'istanbul', name: 'Istanbul', region: 'Istanbul', country: 'Türkiye', lat: 41.0082, lon: 28.9784, hemisphere: 'north', climate: 'temperate', elevationM: 40, relief: 'Rolling relief' },
  { id: 'tokyo', name: 'Tokyo', region: 'Tokyo', country: 'Japan', lat: 35.6595, lon: 139.7005, hemisphere: 'north', climate: 'temperate', elevationM: 40, relief: 'Low relief' },
  { id: 'seoul', name: 'Seoul', region: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978, hemisphere: 'north', climate: 'temperate', elevationM: 38, relief: 'Rolling relief' },
  { id: 'bangkok', name: 'Bangkok', region: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018, hemisphere: 'north', climate: 'tropical', elevationM: 1, relief: 'Low relief' },
  { id: 'singapore', name: 'Singapore', region: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, hemisphere: 'north', climate: 'tropical', elevationM: 15, relief: 'Low relief' },
  { id: 'sydney', name: 'Sydney', region: 'New South Wales', country: 'Australia', lat: -33.8568, lon: 151.2153, hemisphere: 'south', climate: 'temperate', elevationM: 58, relief: 'Rolling relief' },
  { id: 'reykjavik', name: 'Reykjavík', region: 'Capital Region', country: 'Iceland', lat: 64.1466, lon: -21.9426, hemisphere: 'north', climate: 'cold', elevationM: 15, relief: 'Rolling relief' },
]

export function locationById(id: string): MockLocation {
  const found = LOCATIONS.find((loc) => loc.id === id)
  if (!found) throw new Error(`Unknown location ${id}`)
  return found
}

export function randomLocation(exclude: string[] = []): MockLocation {
  const pool = LOCATIONS.filter((loc) => !exclude.includes(loc.id))
  return pool[Math.floor(Math.random() * pool.length)]
}

// --- Mock weather ------------------------------------------------------------

const CONDITIONS: WeatherCondition[] = [
  'Clear sky',
  'Mainly clear',
  'Partly cloudy',
  'Overcast',
  'Drizzle',
  'Rain',
  'Snow',
  'Thunderstorm',
]

/** Deterministic-ish weather from a location so a round reads consistently. */
export function mockWeather(location: MockLocation) {
  const baseTemp =
    location.climate === 'tropical'
      ? 29
      : location.climate === 'arid'
        ? 34
        : location.climate === 'cold'
          ? 6
          : location.hemisphere === 'south'
            ? 16
            : 20
  const jitter = ((location.lat * 37 + location.lon * 13) % 9) - 4
  const temperatureC = Math.round(baseTemp + jitter)
  const condition =
    location.climate === 'arid'
      ? 'Clear sky'
      : CONDITIONS[Math.abs(Math.round(location.lat + location.lon)) % CONDITIONS.length]
  const precipitationMm =
    condition === 'Rain' || condition === 'Drizzle' || condition === 'Thunderstorm'
      ? 0.2 + (Math.abs(location.lon) % 30) / 10
      : 0
  return {
    modelTime: new Date().toISOString(),
    temperatureC,
    condition,
    windSpeedKmh: Math.round(4 + (Math.abs(location.lat) % 22)),
    windDirectionDeg: Math.round(Math.abs(location.lon * 7) % 360),
    humidityPct: Math.round(40 + (Math.abs(location.lat) % 50)),
    pressureHpa: Math.round(1002 + (Math.abs(location.lon) % 28)),
    precipitationMm,
    precipitationIntervalMinutes: precipitationMm > 0 ? 60 : null,
  }
}
