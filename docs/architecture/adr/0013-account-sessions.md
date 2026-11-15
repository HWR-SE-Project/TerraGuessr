# ADR-0013: Add account sessions alongside guest play

Status: Accepted for TerraGuessr 2.0 Phase 2.

## Decision

Keep the existing per-game player token and anonymous flow. Add optional user
accounts for email/password and Google OIDC. Browser sessions use opaque random
tokens in HttpOnly, SameSite=Lax cookies; only SHA-256 token digests are stored
in PostgreSQL. Passwords use Node scrypt with N=2^17, r=8, p=1 and a unique
random salt. Account mutations reject cross-site requests and sensitive routes
are rate limited by Fastify when the app plugin is enabled.

New games created with a valid account session record `ownerUserId`. Existing
and guest games remain unowned. Deleting an account cascades identity, sessions,
preferences, and reset tokens; the nullable game owner is set to NULL so game
and result history continues under the existing R18 six-month purge policy.

Google identity is accepted only after OIDC token signature, issuer, audience,
nonce and verified-email checks. OAuth requests use state and S256 PKCE.
Accounts are not silently merged by matching email: a user must sign into the
existing method before any future linking flow is offered.

Password recovery is only advertised when an SMTP URL, authorized sender, and
application base URL are configured. Reset tokens are random, stored hashed,
expire after 30 minutes, are consumed once, and revoke all existing sessions.

## Consequences and limits

The account schema is additive and migrations preserve existing rows. Google
OAuth and SMTP delivery cannot be considered operational until an operator
provides real credentials and an end-to-end test is completed. No credentials
are included in the repository. Email accounts can currently sign in before
email verification; no verified-email dependent actions are implemented.

The existing anonymous game token is still accepted for legacy and guest games.
An account cookie associates newly created games but does not replace game
ownership authorization. User-specific history endpoints are future work.
