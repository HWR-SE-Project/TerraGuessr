# DEFINITION-OF-DONE.md

Status: frozen (Phase 1). A task/epic is **Done** only when every box below is checked. "Works on
my machine" is not Done. CI green is the authority (ADR-0012).

## Per-task DoD
- [ ] Only owned files changed (MODULE-OWNERSHIP.md); no edits to another agent's files.
- [ ] Matches the frozen contracts (API-CONTRACTS.md, data-model.md) exactly — no shape drift.
- [ ] TypeScript compiles with `strict`; `npm run lint` clean; no `any` in exported signatures.
- [ ] Required tests for the task's requirement rows exist and pass (TESTING-CHECKLIST.md),
      at the correct tier (U/I/E).
- [ ] Unit tests pass locally (they must run under the no-egress sandbox).
- [ ] CI is green on the PR branch (lint + Vitest; e2e if the task touches an E row).
- [ ] No secret committed; no secret/stack in any response or log (R19, ADR-0009).
- [ ] PR body states: Task ID, requirement IDs, summary, how tested.
- [ ] Independent QA review approved (author ≠ approver, git-workflow.md).

## Per-epic DoD
- [ ] All its tasks Done.
- [ ] Every requirement the epic owns is demonstrably satisfied by a passing test (traceable to a
      row in TESTING-CHECKLIST.md and to R01–R20 in the traceability matrix).
- [ ] Integration/e2e rows for the epic pass in CI.

## MVP DoD (the gate that matters most for the budget)
MVP = R01, R02, R03, R04, R06, R07(map), R08, R09, R10, R11, R13, R15 (per
`../process/implementation-backlog.md`). MVP is Done when:
- [ ] A player can complete a full 5-round solo game end-to-end (E test green).
- [ ] Weather shows exactly the 4 mandatory fields in a consistent layout (R03/R06/R15).
- [ ] Actual location is hidden until submit and revealed after (R04/R11) — proven by test.
- [ ] Distance + score computed by the exact formulas, with passing vectors (R09/R10).
- [ ] Weather-failure fallback replaces the location, never serves incomplete data (R13).
- [ ] Pool is land-only (R02) and seeded (R01).
- [ ] `docker compose up` brings the whole stack up and the e2e suite passes against it.

## Project DoD (full R01–R20)
- [ ] MVP DoD met, plus R05, R07(list), R12, R14, R16, R18 implemented and tested.
- [ ] R17 deployment prepared (compose + TLS-ready reverse proxy) — **not executed/purchased**
      without PO approval (decision B.7).
- [ ] R19/R20 structural requirements hold (env-only secrets; modular `frontend/`+`backend/`).
- [ ] Traceability matrix shows every R01–R20 with a passing test reference.
