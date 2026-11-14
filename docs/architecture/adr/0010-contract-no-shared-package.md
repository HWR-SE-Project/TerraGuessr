# ADR-0010: Frozen contract, no shared build package

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Traces to R20, and
to the CI design (separate `backend/` and `frontend/` lockfiles).

## Context
Frontend and backend must agree on request/response shapes. The usual options are (a) a shared
build package imported by both, or (b) a frozen written contract that each side mirrors. The CI
(`.github/workflows/ci.yml`) already assumes **two independent npm projects** with separate
`package-lock.json` files — not an npm workspace. A shared package would force a workspace or a
publish step and couple the two agents' build graphs, creating exactly the cross-ownership
conflicts this handoff is designed to avoid.

## Decision
- **No shared/`packages/` build package.** `docs/agent-handoff/API-CONTRACTS.md` is the frozen
  authority.
- **Backend** implements the contract as TypeBox schemas under `backend/src/contracts/` — the
  runtime source of truth.
- **Frontend** mirrors the contract as hand-written types in `frontend/src/api/types.ts`.
- **Drift is caught by tests, not by a shared type:** a QA contract-conformance e2e asserts live
  responses match the documented shapes (field presence, R04 exclusion of actual coordinates).

## Consequences
Backend and frontend agents never touch a shared file — zero shared-file ownership conflict. The
cost is a small, test-guarded duplication of type definitions. If the project ever adopts npm
workspaces, a generated contract package can replace the mirror without changing endpoint shapes.
