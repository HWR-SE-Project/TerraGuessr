# Security Considerations

Status: Phase 0.5. Covers both the *application* (what we build) and the *development
environment* (the OpenClaw multi-agent setup building it) — these are different trust
boundaries and are kept separate below.

## 1. Application security

### 1.1 Secrets (R19)
API keys and any credentials live outside source code — `.env` locally (gitignored, confirmed
already excluded by the repo's `.gitignore`), platform environment variables in deployment. No
secret is ever committed, logged, or returned in an API response.

### 1.2 Privacy & data minimization (R18, decision B.6)
- No mandatory user registration. Anonymous play is the default and only path in this release.
- Where a result needs to be retrievable, a client-held opaque `playerToken` is used instead of
  an account — it identifies a browser session, not a person.
- Stored per result: score, actual location coordinates, guessed coordinates, timestamp. This is
  the minimum needed to compute/display results and support the leaderboard (R16).
- **Retention: 6 months from creation (R18).** A scheduled job purges `Result` rows older than 6
  months. This is enforced in code (the purge cron), not left as a manual/undocumented process.
- **Jurisdiction note:** the project is developed at HWR Berlin; EU/GDPR principles are applied
  as a matter of good practice (data minimization, defined retention, no unnecessary accounts)
  even though formal legal applicability was not independently confirmed in Phase 0. If the
  deployed app is ever opened to EU users at scale, a proper GDPR compliance review is a
  prerequisite, not an assumption this document makes on your behalf.

### 1.3 Admin endpoints (decision B.14)
`/admin/locations/refresh` and `/admin/weather/prefetch` (see `../architecture/api-contract.md`)
require authentication. No unauthenticated administrative capability ships in any release,
including MVP. Authentication mechanism is designed in Phase 1 against this constraint, not
deferred indefinitely.

### 1.4 Third-party data licensing
- Open-Meteo: CC-BY 4.0 — attribution required in the deployed app (ADR-0003).
- Natural Earth land polygons: public domain, no attribution obligation (ADR-0004).
- Map tiles: provider-dependent usage policy, checked at deployment time, not assumed
  (ADR-0007).

## 2. Development environment security (OpenClaw multi-agent setup)

This section documents the actual, verified state of the agent sandboxing as of Phase 0.5 —
not aspirational config. See also the Phase 0.5 report delivered to the Product Owner for full
verification transcripts.

### 2.1 What's enforced (verified by direct test, not just configured)
- **Filesystem isolation:** each of the 6 specialist agents (`architect`, `frontend`, `backend`,
  `data-engineer`, `qa`, `devops`) runs inside a dedicated Docker container
  (`openclaw-sandbox:bookworm-slim`), with only its own Git worktree bind-mounted read/write at
  `/workspace`. Host paths outside that mount (SSH keys, other agents' worktrees, Downloads, the
  orchestrator's own agent directory) are not present in the container filesystem at all —
  verified directly: `ls`/`cat` against each of these returned "No such file or directory," not
  a permission error, because the path simply isn't mounted.
- **Network isolation:** `docker.network: "none"` per agent. Verified: outbound requests
  (including to the weather API we'll eventually depend on) fail at DNS resolution — no egress
  at all. This is deliberately stricter than Phase 1 will ultimately need (package installs,
  live API calls); revisit when implementation starts (see open items in the Phase 0.5 report).
- **Read-only container root:** `docker.readOnlyRoot: true`. Verified via `mount` output and a
  direct write attempt outside `/workspace`, which failed with "Read-only file system."
- **Dropped capabilities, resource limits:** `capDrop: ["ALL"]`, `pidsLimit: 256`, `memory: 2g`,
  `cpus: 2` per agent container.
- **Non-root execution:** verified — containers run as a non-root uid, not `root`.
- **No cross-agent session snooping:** `sessions_list`/`sessions_history`/`sessions_search` are
  explicitly denied per specialist agent — verified the tools are not even present/callable.
  `tools.agentToAgent.send: []` additionally blocks ordinary cross-agent messaging — verified
  with a live attempt (`qa` → `ui`), which was rejected with a `forbidden` status.
- **Elevated-exec escape hatch closed:** `tools.elevated.enabled: false` per specialist agent —
  the sandbox cannot be bypassed by requesting host-direct execution.
- **Personal agents untouched:** the 5 pre-existing personal-assistant agents (`ui`, `debugging`,
  `security`, `performance`, `reviewer`) were not modified — config diffed before/after to
  confirm.
- **Config backup:** a full pre-change snapshot of `openclaw.json` and all agent directories was
  taken before any Phase 0.5 config change (see Phase 0.5 report for location).

### 2.2 Known, deliberately un-fixed gap
`tools.sessions.visibility` is a **root-level-only** setting (confirmed via schema inspection —
there is no per-agent override). It currently resolves to "all" (Gateway-wide), inherited from
before this project started. Changing it would affect the 5 personal agents too, which the
Product Owner's instructions explicitly require to stay unchanged. **This was deliberately not
changed.** In practice this gap is closed for the 6 specialists by denying the
`sessions_list`/`sessions_history`/`sessions_search` tools directly (§2.1) — they cannot exploit
the broad visibility because they don't have the tools to query it — but the underlying root
setting itself remains "all." This is a structural trade-off, not an oversight; resolving it
fully would require either a global visibility change (out of scope per the Product Owner's
"keep personal agents unchanged" instruction) or an OpenClaw feature (per-agent session
visibility) that does not exist in the installed version (2026.11.1).

### 2.3 Orchestrator (`main`) is intentionally unsandboxed
`main` is not included in the sandboxing changes above — it retains direct host access, which
is required for it to actually coordinate (spawn, patch config, read worktrees as needed). This
matches the documented OpenClaw model (`mode: "non-main"` exists precisely because the
orchestrator is expected to stay on the host). `main`'s trust level is already the operator's own
— no new boundary needed there.
