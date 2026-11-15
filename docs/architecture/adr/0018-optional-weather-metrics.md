# ADR-0018: Optional weather metrics remain nullable

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The game needs more weather clues than the four established mandatory R03 values. Open-Meteo
exposes surface pressure and 10 m wind direction, but provider fields can be absent or null.
Rejecting a location for a missing extra field would unnecessarily block a round.

## Decision

Request surface pressure (hPa), 10 m wind direction (degrees clockwise from north), UV index,
daily sunshine duration (seconds), and provider-local current time from the existing Open-Meteo adapter. Persist them as nullable columns on `WeatherSnapshot`, return explicit
`null` values when unavailable, and render an unavailable marker in the HUD. Keep the original
temperature, precipitation, humidity, and wind-speed requirements unchanged and mandatory.
Preserve snapshots already stored before this migration; the migration only adds nullable fields.

The HUD links to Open-Meteo attribution. The free/open-access endpoint is limited to non-commercial
use and subject to provider request limits. A commercial deployment must use the provider's
commercial plan; TerraGuessr does not activate a paid endpoint or key automatically.

## Consequences

- Missing optional measurements never make a location ineligible and are never replaced with invented data.
- Round and Daily Challenge responses carry the same available snapshot values.
- The data-source register records provider, units, cache age, attribution/license, restrictions,
  and outage behavior.
- Additional intelligence panels remain out of scope until their providers receive a separate
  coverage, freshness, licensing, and cost review.
