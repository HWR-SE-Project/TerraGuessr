# ADR-0009: Error envelope and request validation

**Status:** Accepted (Principal Architect, Phase 1 finalization, 2026-11-14). Traces to R04, R08,
R13, R19, decision B.14.

## Context
The API contract defined endpoint shapes but no canonical error format and no validation library.
Without one fixed choice, each agent would invent its own, producing inconsistent responses and
contract-drift between frontend and backend.

## Decision
- **Validation = Fastify + TypeBox** (`@sinclair/typebox` + `@fastify/type-provider-typebox`).
  TypeBox schemas are the single runtime source of truth and also generate static TS types — one
  artifact, no duplication, native to Fastify (no extra parse step like Zod). Every route declares
  `body`/`params`/`querystring`/`response` schemas; invalid input is rejected before the handler.
- **Canonical error envelope** for every non-2xx response:
  ```json
  { "error": { "code": "SNAKE_CASE_CODE", "message": "human readable", "details": {} } }
  ```
  `details` is optional. A single Fastify `setErrorHandler` produces this shape for all errors.
- **Status → code map:**
  | HTTP | code | when |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | schema validation failed (`details` = field errors) |
  | 401 | `UNAUTHORIZED` | missing/invalid `X-Player-Token` or admin bearer |
  | 404 | `NOT_FOUND` | game/round/result/challenge does not exist or not owned by token |
  | 409 | `CONFLICT` | guess already submitted, round not active, game already completed |
  | 503 | `SERVICE_UNAVAILABLE` | no location with complete weather could be selected (R13 exhausted) |
  | 500 | `INTERNAL_ERROR` | unexpected; never leaks stack/secret (R19) |

## Consequences
Frontend handles exactly one error shape. The R04 regression test and admin-auth tests assert
against fixed codes. Secrets/stack traces never appear in responses.
