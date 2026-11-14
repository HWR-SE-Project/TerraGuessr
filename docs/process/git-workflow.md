# Git Collaboration Workflow

Status: Phase 0.5 — configuration/process only, no application code yet.

## Branch naming

`<agent-or-author>/<epic-or-topic>-<short-description>`, e.g.:
- `backend/epic1-weather-integration`
- `frontend/epic3-leaflet-map`
- `qa/epic2-scoring-tests`

Agent-authored branches are created inside that agent's own isolated worktree
(`openclaw/<agent>-terraguessr-phase05`, see security-considerations.md §2.1) and pushed from
there — never committed directly to `main`.

## Pull requests

- Every change lands via PR, never a direct push to `main`.
- Every PR requires an independent QA review (the `qa` agent, or a human) before merge — the
  author of a change does not approve their own PR.
- CI (`.github/workflows/ci.yml`) must pass: lint, Vitest, Playwright.

## Branch protection

`main` should be protected (require PR, require status checks, require review) wherever
repository permissions allow it. See the Phase 0.5 report for the actual permission check result
on `HWR-SE-Project/v1.0.0-initial-commit` — this document states the policy; the report states
whether it was actually possible to enable given current access.

## Worktree readiness

Each of the 6 specialist agents has its own managed, isolated Git worktree of this repository
(branch `openclaw/<agent>-terraguessr-phase05`, created via `openclaw worktrees create`). See the
Phase 0.5 report for the per-agent verification status.
