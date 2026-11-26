import { hashSecret, normalizeEmail } from './service.js';

export type EmailRateLimitNamespace = 'password-reset' | 'verification-resend';

export interface EmailRateLimitOptions {
  /** Maximum requests allowed for a single normalized email within `windowMs`. */
  maxPerWindow: number;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
  /** Minimum delay in milliseconds between consecutive requests for the same email. */
  cooldownMs: number;
  /** Upper bound on tracked keys to prevent unbounded memory growth under spray attacks. */
  maxKeys?: number;
  /** Clock function (injectable for deterministic tests). */
  now?: () => number;
}

export type EmailRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'cooldown' | 'window'; retryAfterSeconds: number };

const DEFAULT_MAX_KEYS = 10_000;

/**
 * In-memory per-email sliding-window + cooldown rate limiter for unauthenticated
 * auth email endpoints. Keys are hashed after email normalization so raw addresses
 * are never retained in memory and non-existent emails hit the exact same buckets
 * as existing accounts (no account enumeration).
 */
export class EmailRateLimiter {
  private readonly entries = new Map<string, number[]>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  public constructor(options: EmailRateLimitOptions) {
    this.maxPerWindow = options.maxPerWindow;
    this.windowMs = options.windowMs;
    this.cooldownMs = options.cooldownMs;
    this.maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
    this.now = options.now ?? (() => Date.now());
  }

  public consume(namespace: EmailRateLimitNamespace, email: string): EmailRateLimitResult {
    const current = this.now();
    const key = `${namespace}:${hashSecret(normalizeEmail(email))}`;
    const cutoff = current - this.windowMs;

    const existing = this.entries.get(key);
    const active = existing ? existing.filter((ts) => ts > cutoff) : [];

    if (active.length === 0 && existing) {
      this.entries.delete(key);
    }

    if (active.length > 0 && this.cooldownMs > 0) {
      const latest = active[active.length - 1]!;
      const cooldownRemainingMs = latest + this.cooldownMs - current;
      if (cooldownRemainingMs > 0) {
        return {
          allowed: false,
          reason: 'cooldown',
          retryAfterSeconds: Math.max(1, Math.ceil(cooldownRemainingMs / 1000)),
        };
      }
    }

    if (active.length >= this.maxPerWindow) {
      const oldest = active[0]!;
      const windowRemainingMs = oldest + this.windowMs - current;
      return {
        allowed: false,
        reason: 'window',
        retryAfterSeconds: Math.max(1, Math.ceil(windowRemainingMs / 1000)),
      };
    }

    active.push(current);
    // Re-insert so Map iteration order tracks most-recently-active keys.
    this.entries.delete(key);
    this.entries.set(key, active);

    if (this.entries.size > this.maxKeys) {
      this.evict(cutoff);
    }

    return { allowed: true };
  }

  private evict(cutoff: number): void {
    for (const [k, timestamps] of this.entries) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1]! <= cutoff) {
        this.entries.delete(k);
      }
    }
    while (this.entries.size > this.maxKeys) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}

export function formatWaitDuration(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe < 60) {
    return `${safe} second${safe === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(safe / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function formatEmailRateLimitMessage(
  result: Extract<EmailRateLimitResult, { allowed: false }>,
): string {
  const wait = formatWaitDuration(result.retryAfterSeconds);
  if (result.reason === 'cooldown') {
    return `Please wait ${wait} before requesting another email.`;
  }
  return `Too many email requests for this address. Please try again in ${wait}.`;
}
