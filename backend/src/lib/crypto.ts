/**
 * Shared low-level crypto primitives (ADR-0011).
 *
 * Token hashing is a security-relevant invariant: the server must store only
 * SHA-256 hex of raw tokens, and compare them in constant time. These helpers
 * were previously duplicated across the auth service, the player-token plugin
 * and the Google-flow cookie verifier — if one copy ever changed (e.g. to
 * base64url or another digest), every token would silently stop matching.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex digest of a raw value (store/compare hashes only). */
export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** A 256-bit opaque token (base64url), returned to the client exactly once. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Constant-time comparison. Lengths are compared before `timingSafeEqual`,
 * which requires equal-length buffers. Accepts strings (hashes/signatures) or
 * pre-derived buffers.
 */
export function timingSafeEquals(
  a: string | Buffer,
  b: string | Buffer,
): boolean {
  const bufferA = typeof a === 'string' ? Buffer.from(a, 'utf8') : a;
  const bufferB = typeof b === 'string' ? Buffer.from(b, 'utf8') : b;
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
