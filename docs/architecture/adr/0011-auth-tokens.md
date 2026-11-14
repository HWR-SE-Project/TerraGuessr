# ADR-0011: Player tokens and admin authentication

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Traces to R04, R18,
decisions B.6 and B.14.

## Context
Decision B.6 mandates anonymous play via a client-held opaque `playerToken`; decision B.14
mandates that `/admin/*` is authenticated. Neither the token format/transport nor the admin
mechanism was specified, so agents cannot implement ownership checks or admin guards.

## Decision
- **Player token:** on `POST /games` the server generates a 256-bit random token
  (`crypto.randomBytes(32)`, base64url). The **raw token is returned once** in the response body.
  The server stores only its **SHA-256 hash** (`Game.playerTokenHash`) — never the raw token, no
  PII. The client stores the raw token (localStorage) and sends it on every owned-resource request
  via the **`X-Player-Token`** header. Ownership = `sha256(header) === Game.playerTokenHash`;
  mismatch/absence ⇒ `404 NOT_FOUND` (not 401 — do not reveal that the resource exists).
- **Admin:** a static secret `ADMIN_API_TOKEN` (env, R19) sent as `Authorization: Bearer <token>`;
  compared in constant time (`crypto.timingSafeEqual`). Missing/wrong ⇒ `401 UNAUTHORIZED`. This
  applies to every `/admin/*` route with no exception (B.14).
- **Challenge leaderboard** (`GET /challenges/{id}/leaderboard`) is public — no token (B.3/B.6).

## Consequences
No account system, no password storage, minimal PII (hash only). A leaked DB cannot be used to
impersonate players (tokens are hashed). Admin auth is a single plugin guard, trivially testable
("every `/admin/*` route rejects unauthenticated"). A future real auth system can replace the
static admin token without touching player flows.
