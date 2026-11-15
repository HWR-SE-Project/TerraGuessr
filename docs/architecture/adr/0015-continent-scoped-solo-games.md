# ADR-0015: Enforce continent-scoped solo sessions

Status: Accepted for TerraGuessr 2.0 Phase 3.

## Decision

Store an optional `geoRegion` and `candidateCount` on each solo `Game`. The
server scopes both round selection and the visible list candidates to the
configured continent. The option count is only stored when explicitly
configured and is limited to 2–4; otherwise the current Easy/Medium preset
counts are preserved. World scope and existing clients remain the defaults.

Country-level selection is not offered because the current seeded location
catalog has no verified country code. The UI explains this limitation instead
of estimating a country from coordinates. Existing region labels in the pool
remain the canonical continent classification.

## Consequences

The migration adds nullable columns, preserving existing games. The configured
geography is applied to server selection, prefetch and candidate reconstruction
on reload, so it cannot be changed by tampering with client state. Challenge
games retain their existing fixed shared location behavior.
