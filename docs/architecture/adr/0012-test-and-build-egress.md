# ADR-0012: Test tiers and the sandbox-egress constraint

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Traces to the
testing strategy and to `security-considerations.md` §2.2 (agent network isolation).

## Context
`security-considerations.md` records that each specialist agent runs with `docker.network:
"none"` — **no egress at all**, verified by test. That blocks, inside the agent sandbox: `npm ci`
(registry), Prisma engine/CLI downloads, Playwright browser installs, and every Open-Meteo call.
Integration and e2e tests therefore **cannot run inside the agent sandboxes** as currently
configured. This is the single largest implementation-time risk and must be designed around, not
discovered mid-build.

## Decision
Three test tiers with explicit execution environments:
1. **Unit (pure)** — scoring, distance, selection core (RNG injected), weather-field validation,
   DTO shaping, error mapping. No DB, no network, no Prisma client. **Runs anywhere**, including
   inside the no-egress sandbox. This is where the mathematically-specified behavior (ADR-0006/
   0008) is proven.
2. **Integration** — Prisma repositories + Fastify route handlers against a disposable Postgres.
   Runs **locally via `docker compose` and in CI via a `services: postgres` container** — not in
   the agent sandbox.
3. **End-to-end (Playwright)** — full stack via `docker compose`. Runs **in CI** (needs browser
   install + a running stack). Open-Meteo is **stubbed** in integration/e2e via an injectable
   weather-client interface, so tests are deterministic and need no live egress.

## Decision for the orchestrator / Product Owner
To let agents do more than write unit tests, Phase 1 needs **controlled egress** for the
`backend`/`data-engineer`/`devops` sandboxes: an allowlist of the npm registry, the Prisma binary
host, the Playwright CDN, and `api.open-meteo.com`. Enabling this is an OpenClaw config change and
is **explicitly out of scope until the Product Owner approves it** (per the restrictions). Until
then, integration/e2e validation happens **only in CI**, and agents must treat CI as the
authoritative test gate.

## Consequences
All requirement-critical logic (R09/R10 scoring, R13 fallback, R04 hiding, R18 purge) is provable
by tier-1 unit tests that run even under full network isolation. DB/stack behavior is gated by CI.
The weather client is an injected interface in all tiers — never a hard dependency on live
Open-Meteo during tests.
