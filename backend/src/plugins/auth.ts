/**
 * Player-token helpers (ADR-0011).
 *
 * Anonymous play is addressed by a client-held opaque token. On game creation
 * the server generates a 256-bit token and stores only its SHA-256 hash; the
 * client sends the raw token back on every owned-resource request via the
 * `X-Player-Token` header. Missing/unknown tokens are reported as 404
 * NOT_FOUND (never 401) so the API does not reveal whether a resource exists.
 */

import type { FastifyRequest } from 'fastify';

import { AppError } from './errors.js';
import { randomToken, sha256Hex } from '../lib/crypto.js';

/** Generate a 256-bit opaque player token (base64url), returned to the client once. */
export function generatePlayerToken(): string {
  return randomToken();
}

/** SHA-256 hex digest of a raw player token (ADR-0011: store/compare hashes only). */
export function hashPlayerToken(rawToken: string): string {
  return sha256Hex(rawToken);
}

/**
 * Read an opaque token header (ADR-0011). Returns the raw token, or `undefined`
 * when the header is missing or blank. Callers decide whether a missing token
 * is a 404 (game/lobby tokens) or an optional value (host self-identification).
 */
export function readTokenHeader(
  request: FastifyRequest,
  headerName: string,
): string | undefined {
  const raw = request.headers[headerName];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * 404 NOT_FOUND thrown for a missing game or a missing/wrong token. The message
 * is identical in both cases so the API never reveals resource existence.
 */
export class GameNotFoundError extends AppError {
  public constructor() {
    super(404, 'Game not found');
  }
}
