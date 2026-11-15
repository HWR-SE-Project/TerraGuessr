# ADR-0003: Open-Meteo as the weather data source

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
R03 requires temperature, precipitation, humidity, and wind speed for *every* candidate
location (R01/R02 — land points, potentially arbitrary coordinates, not just weather-station
sites). Station-based APIs (e.g. Meteostat) have coverage gaps that conflict with this. DWD
(Deutscher Wetterdienst) only covers Germany/EU, not a global pool.

## Decision
Open-Meteo as the primary and only weather data source for this release.

## Rationale
- Gridded model: returns data for arbitrary coordinates, not just station sites — this is what
  makes "every land location has all 4 mandatory fields" (R03) actually achievable.
- No API key required for non-commercial use (aligns with R19 — nothing to leak).
- CC-BY 4.0 licensed — attribution required, no other redistribution restriction identified.
- Rate limits and costs: server-side only, via the prefetch/cache layer (decision B.11/B.12) —
  the server calls Open-Meteo, cached snapshots serve players. Clients never call the weather
  API directly.

## Consequences
Attribution to Open-Meteo must appear in the deployed app. If Open-Meteo's free-tier limits
change materially, this ADR should be revisited — the caching layer bounds our call volume
regardless, so the exposure is limited.
