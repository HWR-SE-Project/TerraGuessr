# ADR-0004: Pre-baked land/sea mask from Natural Earth

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
R02 requires locations to be on land/islands only. Random lat/lon sampling lands in open ocean
~71% of the time (noted directly in `appidee.odt`). Decision B.8 requires "reasonable global
diversity" in the pool.

## Decision
Pre-bake a validated `Location` candidate pool offline using Natural Earth land polygons
(public domain, no attribution burden), rather than doing live land/sea checks per round.

## Rationale
- Natural Earth is public domain — no licensing obligation, unlike OSM coastline data (ODbL,
  share-alike).
- Pre-baking means R01's "random location per round" selects from an already-validated pool —
  no runtime geolocation lookups, no risk of serving an ocean coordinate.
- Satisfies decision B.8 (global diversity) by deliberately sampling across continents/regions
  at seed time, not leaving it to chance.

## Consequences
The pool must be re-seeded if global diversity or resolution requirements change. Coastline/
islet resolution is a tunable parameter of the seed job, not a runtime concern.
