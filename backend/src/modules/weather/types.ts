/**
 * Weather domain types (R03/R06).
 *
 * `WeatherClient` is the injectable provider seam (ADR-0012): services depend
 * on the interface and never call `fetch` directly, so Open-Meteo can be
 * stubbed in unit, integration, and e2e tests.
 */

/** Mandatory weather fields for a location (R03/R06). All four are always present. */
export interface WeatherData {
  temperatureC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
}

/** Injectable weather provider interface (ADR-0012, architecture.md §11). */
export interface WeatherClient {
  getCurrent(lat: number, lon: number): Promise<WeatherData>;
}
