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

Email/password registration now requires proof of address ownership. A random
single-use token (SHA-256 digest stored, 24-hour expiry) is emailed as an
`<APP_BASE_URL>/verify-email?token=…` link and consumed by a POST endpoint, so
mail scanners cannot activate accounts with a bare GET. Sign-in is refused
with `EMAIL_NOT_VERIFIED` until the address is confirmed. Completed password
resets also mark the address verified because they prove the same control.
Production registration fails closed (503) if SMTP is not configured. In
non-production only, a missing SMTP configuration auto-verifies and signs the
account in so local development and e2e keep working; that fallback never
runs with `NODE_ENV=production`.

Changing an address is treated as an identity change, not a profile edit. An
authenticated request re-checks the current password when one is set, rejects
addresses already in use, and stores the proposal in `EmailChangeRequest`
without touching `User.email`. Two single-use hashed tokens (60-minute expiry)
are emailed: a confirmation-required message to the current address, which acts
as the owner's veto, and a confirmation-required message to the proposed
address, which proves control of the destination. The change applies only after
both confirm; a row lock serializes simultaneous confirmations so both arriving
at once cannot leave the request half-applied. A newer request supersedes any
pending one. Completion marks the new address verified, deletes every session,
and clears the cookie, forcing sign-in with the new identity. This follows the
OWASP recommendation to confirm both addresses when no MFA is available; the
trade-off is that users who have already lost access to the old inbox must use
account support instead of self-service.

## Consequences and limits

The account schema is additive and migrations preserve existing rows. Accounts
created before verification was enforced are backfilled as verified so the
migration does not lock out existing users. Google OAuth and SMTP delivery
cannot be considered operational until an operator provides real credentials
and an end-to-end test is completed. No credentials are included in the
repository.

The existing anonymous game token is still accepted for legacy and guest games.
An account cookie associates newly created games but does not replace game
ownership authorization. User-specific history endpoints are future work.
