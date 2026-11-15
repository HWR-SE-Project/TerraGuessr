# ADR-0001: Modular monolith, not microservices

**Status:** Accepted (Product Owner, Phase 0.5, 2026-11-14)

## Context
R20 requires frontend/backend to be modularly separated in source. All 20 requirements are
simple reads/writes at the scale of a university team project.

## Decision
One backend deployable + one frontend SPA, separated as `backend/` and `frontend/` modules in
one repository. No microservices, no Kubernetes.

## Rationale
R20 asks for separation of concerns in source, not separate deployables. Microservices would
add network calls, deployment complexity, and operational burden with no requirement driving it.

## Consequences
If a component ever needs independent scaling (unlikely at this scope), it can be extracted
later — the modular boundary already exists in source.
