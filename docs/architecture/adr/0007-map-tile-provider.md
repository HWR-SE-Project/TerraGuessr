# ADR-0007: Map tile provider selection deferred to deployment time

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
R07 needs an interactive map (Leaflet). OpenStreetMap's own tile service
(`tile.openstreetmap.org`) disallows heavy/production use under its usage policy. Decision B.13
explicitly instructs: do not assume OSM's public tile service is universally prohibited, but use
tiles according to the provider's actual usage policy.

## Decision
Leaflet (provider-agnostic) in code. The specific OSM-*compatible* tile provider/endpoint is
selected at deployment time (R17), after checking that provider's current usage terms permit our
expected traffic — not hardcoded as a code-time architectural assumption.

## Rationale
Leaflet doesn't care which XYZ tile endpoint it's pointed at. Locking in a specific provider now,
before deployment scale/traffic is known, risks picking one whose free tier doesn't actually fit
— this is a deployment-time fit check, not a code design question.

## Consequences
Before R17 execution, re-verify the chosen provider's usage policy (self-hosted tile server,
MapTiler-style managed provider, or another OSM-compatible option) and document the choice here
as an update to this ADR.
