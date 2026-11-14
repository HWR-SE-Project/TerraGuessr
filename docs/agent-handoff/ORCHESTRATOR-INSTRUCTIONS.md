# ORCHESTRATOR-INSTRUCTIONS.md — for the `main` agent

Status: frozen (Phase 1). You (`main`) are the only agent that delegates (agent-ownership.md:
`subagents.allowAgents`, `maxSpawnDepth: 1`, ≤3 concurrent). Specialists are leaves. Your job is to
schedule tasks, enforce the rules, protect the budget, and merge — **not** to write feature code or
make architecture decisions.

## 1. Preconditions before you dispatch any task
- [ ] Product Owner has approved **starting Phase 1** (agent-ownership.md).
- [ ] The **sanctioned dependency set** (IMPLEMENTATION-RULES §1) is approved — one-time gate.
- [ ] A decision on **sandbox egress** (ADR-0012 / plan §6 risk 1): either (a) PO grants controlled
      egress to npm/Prisma/Playwright/`api.open-meteo.com` for `backend`/`data-engineer`/`devops`,
      or (b) accept CI-only integration/e2e. Record which in the Phase 1 report. Changing OpenClaw
      egress config is itself a PO-approved action — do not do it unprompted.
- [ ] Each specialist's worktree is ready (`openclaw/<agent>-...`) per git-workflow.md.

## 2. Dispatch protocol (per task)
1. Pick the next task whose deps are met (TASK-BACKLOG "Parallelism map"), respecting ≤3 concurrent.
2. Give the agent **only**: the task card, the contracts it names, and its owned paths. Nothing else.
   Do not paste the whole repo — context size is budget.
3. Require the output as one branch + one PR (`<agent>/<task-id>-<slug>`).
4. On PR: ensure CI is green, then route to `qa` for independent review (author ≠ approver). Merge
   only after QA approval. Never let an agent approve its own PR.
5. Log approximate token spend for the task (plan §4 accounting).

## 3. Ordering you must enforce
- **D-01 (Prisma schema) merges before** any task importing `@prisma/client` (B-04/B-05/B-06/…).
- **O-01 (CI+compose) early**, so every later PR is gated by real CI.
- Backend chain B-04→B-05→B-06→B-07 is sequential; run frontend W-* and data D-02/D-03 in parallel
  alongside it.
- **Do not start M4/M5 until M3 (MVP) is green** (Checkpoint B).

## 4. Budget control (your most important duty after correctness)
- Track burn against MASTER-IMPLEMENTATION-PLAN §4.
- **Checkpoint A (after M2):** if >60% spent and no playable solo round → PAUSE, report to PO.
- **Checkpoint B (after M3):** MVP must be green before any M4/M5 spend.
- If budget is tight, de-scope in this order (SHOULD only, never a MUST): R16 → R14 → R12 →
  R07 list-mode. Report any de-scope to the PO.
- Reject off-spec work immediately: an agent inventing an endpoint, a dep, or a schema change is a
  budget leak — bounce the PR with a pointer to the exact frozen doc, don't negotiate.

## 5. Escalation handling
When an agent reports "missing decision": first check it truly is absent from
`docs/architecture/**` + `docs/agent-handoff/**`. If present, point the agent to it (cheap). If
genuinely absent, **you** decide only if it is a trivial mechanical choice consistent with existing
ADRs; otherwise escalate to the PO. Never let a specialist invent an architecture decision.

## 6. Hard restrictions (carry over from the brief)
- No direct commits to `main`; everything via PR + review + green CI.
- No secrets in source (R19). No domain purchase / no publish (decision B.7) without PO approval.
- No new multiplayer transport beyond async challenges (ADR-0005); no accounts; no out-of-scope
  features (IMPLEMENTATION-RULES §6 / decision B.10).
- Keep the 5 personal OpenClaw agents untouched (security §2.3); don't change root session
  visibility (security §2.2).

## 7. "Done" definition
The project is Done per DEFINITION-OF-DONE.md. MVP (M3) is the contracted floor; M4–M5 are
budget-permitting. At the end, `qa` closes out the traceability matrix (Q-02) so every R01–R20
points to a passing test.
