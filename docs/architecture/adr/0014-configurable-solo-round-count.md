# ADR-0014: Persist the configured solo round count

Status: Accepted for TerraGuessr 2.0 Phase 3.

## Decision

Keep five rounds as the default for existing clients and games. New solo games
may choose 1–20 rounds; the count is validated on game creation and stored in
the `Game.roundsTotal` column. Round progression, final-game completion,
prefetch, summaries and the client result flow all use that persisted value.
Async challenge games remain one shared round and ignore no hidden client-side
timer or attempt settings because those are not yet implemented.

## Consequences

The migration is additive and gives all existing games a default of five. The
browser setup exposes the implemented solo round count and existing difficulty
selection. Geography scope, time limit, attempts, additional-data unlocks and
live multiplayer room options remain out of scope until their complete server
rules and participant state are implemented.
