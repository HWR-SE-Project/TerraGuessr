# ADR-0005: Asynchronous shared challenges before real-time multiplayer

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
R16 (SHOULD, "Begeisterungsmerkmal" in the Kano table) asks for multiplayer where players guess
the same location and compare scores. The source idea document itself flags real-time PvP as
"best kept optional." Synchronous real-time play would force a WebSocket/real-time transport
layer — the single largest architectural complexity jump identified in Phase 0.

## Decision
Implement asynchronous shared challenges only in this release (decision B.3): one fixed round,
multiple players attempt it independently, results compared on a leaderboard. No WebSockets, no
live presence, no real-time sync.

## Rationale
Satisfies R16's literal requirement (same location, comparable scores) without the cost of
real-time infrastructure. REST-only keeps the stack to what's in ADR-0001/0002.

## Consequences
The API is shaped (see `../api-contract.md`) so a synchronous/real-time mode could be added
later as additive endpoints, not a rewrite — but that is explicitly out of scope now.
