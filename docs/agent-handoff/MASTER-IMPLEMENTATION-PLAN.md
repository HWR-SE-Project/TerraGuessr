# MASTER-IMPLEMENTATION-PLAN.md

Status: frozen (Principal Architect, Phase 1, 2026-11-14). The authoritative plan the 7 DeepSeek
agents execute. Companion docs: TASK-BACKLOG, API-CONTRACTS, MODULE-OWNERSHIP, IMPLEMENTATION-RULES,
TESTING-CHECKLIST, DEFINITION-OF-DONE, ORCHESTRATOR-INSTRUCTIONS. Requirements: `../requirements/
traceability-matrix.md` (R01–R20). All architecture is decided — agents implement, they do not design.

## 1. Objective & strategy
Ship a tested MVP first, then fast-follow features, then challenges + deployment prep — within a
**$20 DeepSeek budget**. Budget is protected by: frozen contracts (no exploration), single-owner
files (no rework from conflicts), pure deterministic domain logic (cheap, high-value tests), and
CI as the authoritative test gate (no repeated manual AI review).

## 2. Milestones

| M | Name | Tasks | Requirements reached | Gate |
|---|---|---|---|---|
| M0 | Foundations | F-01,F-02,D-01,O-01 | R20 scaffold, CI/compose | builds + CI valid + schema migrates |
| M1 | Data layer | D-02,D-03 | R01,R02,R03,R06,R13(core) | pool seeded, weather cache+validate tested |
| M2 | Core solo loop | B-02..B-07,W-02,W-03 | R01,R03,R04,R06,R07(map),R08,R09,R10,R11,R13 | solo round playable |
| M3 | **MVP complete** | W-04,W-05,Q-01 | + R05,R07(list),R15,R02 | **MVP DoD green in CI** |
| M4 | Fast-follow | B-08,B-09,W-06 | R12,R14,R18 | prefetch/purge/tutorial tested |
| M5 | Challenges + deploy prep | B-10,W-07,B-11,O-02,Q-02 | R16,R17(prep),B.14 | full R01–R20 traced + green |

**MVP (M3) is the primary deliverable.** If the budget runs out after M3, the project has a
complete, tested, playable game satisfying all MUST requirements + R02/R05/R07/R15.

## 3. Critical path & parallelism
Critical path: `D-01 → D-02/D-03 → B-04 → B-05 → B-06 → B-07 → Q-01 (MVP)`. Everything else is
parallel slack (see TASK-BACKLOG "Parallelism map"). Concurrency cap = 3 running subagents
(agent-ownership.md). Frontend (W-*) proceeds against the frozen contract with stubbed data, so it
never waits on the backend chain except at the Q-01 integration point.

## 4. Budget model & financial checkpoints
Assume DeepSeek-V3-class pricing (~\$0.3–0.6 / 1M tokens, cache-discounted reads cheaper). The plan
is engineered so most token spend is **one-pass code generation against a fixed spec**, not
dialogue. Rough envelope (orchestration + generation + CI-fix loops), not a guarantee:

| Phase | Expected share of budget | Hard stop if exceeded |
|---|---|---|
| M0 | ~15% (~\$3) | re-check scaffolds are minimal; no framework exploration |
| M1–M2 (to playable) | ~45% (~\$9) | **CHECKPOINT A** below |
| M3 (MVP green) | ~20% (~\$4) | **CHECKPOINT B** — stop-the-line if MVP not green |
| M4–M5 | ~20% (~\$4) | de-scope to remaining budget, SHOULD-features first-out |

**Checkpoint A (after M2):** if >60% of budget is consumed before a solo round is playable, the
orchestrator PAUSES and reports to the PO — likely causes are agents exploring instead of following
the spec (IMPLEMENTATION-RULES §0) or a CI config problem burning fix-loops. Do not push through.

**Checkpoint B (after M3):** MVP must be green. If budget remains, proceed to M4→M5 in order,
dropping the lowest-priority remaining SHOULD requirement first if money is tight. Drop order:
R16 → R14 → R12 → R05(list only) — never drop a MUST.

**Running-cost accounting:** the $20 ceiling is *additional* DeepSeek spend and must absorb any
residual project costs. The orchestrator logs approximate token spend per completed task so the PO
can see burn vs. the table above. Claude Code architecture work (this phase) is on the user's
existing subscription and does **not** count against the $20.

## 5. Token-efficiency rules (how the plan stays cheap)
- Agents load only their task card + referenced contracts + owned files (IMPLEMENTATION-RULES §5).
- No agent re-derives an architecture decision; "missing decision" → escalate, don't explore.
- Deterministic tooling over LLM reasoning: `prisma migrate`, TypeBox validation, ESLint, Vitest,
  Playwright do the checking — not an AI re-reading diffs.
- CI log is the authority on failures; agents fix from the log, they don't re-explore the codebase.
- One task → one small PR; big PRs cause expensive review re-reads.

## 6. Risks carried into implementation (see also "readiness")
1. **Sandbox has no network** (security §2.2 / ADR-0012): agents can run only unit tests locally;
   integration/e2e run in CI. PO should decide whether to grant controlled egress (npm/Prisma/
   Playwright/Open-Meteo) for Phase 1 — otherwise CI is the *only* integration gate and the
   feedback loop (and thus token cost) grows.
2. **DeepSeek vs. spec fidelity:** weaker models drift; the frozen contracts + single-owner files +
   escalate-don't-explore rule are the mitigations. The orchestrator must reject off-spec PRs fast.
3. **$20 may not reach M5.** Acceptable: MVP (M3) is the contracted floor; M4–M5 are budget-permitting.
