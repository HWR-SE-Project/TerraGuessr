# Agent Ownership & Collaboration Rules

Status: Phase 0.5. Governs the 6 TerraGuessr specialist agents (`architect`, `frontend`,
`backend`, `data-engineer`, `qa`, `devops`) under the `main` orchestrator. Does not apply to the
5 unrelated personal-assistant agents (`ui`, `debugging`, `security`, `performance`, `reviewer`),
which are out of scope for this project entirely.

## Roles

| Agent | Owns | Does not own |
|---|---|---|
| `architect` | Architecture decisions, ADRs, requirements traceability upkeep | Implementation |
| `backend` | API implementation, data model, scoring/distance logic, scheduler jobs | UI, infra |
| `frontend` | SPA, map/list selection UI, tutorial, difficulty UI | API internals |
| `data-engineer` | Location pool seeding, weather integration, caching correctness | UI, deployment |
| `qa` | Acceptance criteria per epic, test authorship/maintenance, independent PR review | Writing the feature code it reviews |
| `devops` | CI/CD, containerization, deployment prep (not execution — see below) | Feature code |

## Delegation model (as configured in OpenClaw)

`main` is the only agent allowed to delegate to the 6 specialists (`subagents.allowAgents`).
Specialists cannot delegate further (`allowAgents: []`, enforced both per-agent and by the
global `maxSpawnDepth: 1`) — every delegated task is a leaf, reporting directly back to `main`.
Max concurrent subagent runs: **3** (unchanged, section F).

## Working model per specialist

Each specialist works in its own isolated Git worktree + Docker sandbox container (see
`../security/security-considerations.md` §2.1) — never directly on `main` or in another agent's
worktree. Branch naming and PR flow: `git-workflow.md`.

## What requires Product Owner approval vs. what doesn't

- Requires approval: starting Phase 1 implementation, any new framework/dependency not already
  named in `../architecture/architecture.md` §2, purchasing/publishing the domain (R17),
  enabling any multiplayer transport beyond async challenges (ADR-0005), any account/auth system.
- Does not require approval: implementing an already-approved epic from
  `implementation-backlog.md` once Phase 1 formally starts, writing tests, fixing bugs within
  approved scope.
