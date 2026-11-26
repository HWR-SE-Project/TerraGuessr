import type { RoundScene } from '../../domain/scene.js';
import type { PanoramaProvider, PanoramaTarget } from './provider.js';
import {
  selectRoundWithWeather,
  type IntelligenceLookup,
  type PanoramaLocator,
} from './locationSelection.js';

export interface WarmRoundEntry {
  target: PanoramaTarget;
  scene: RoundScene;
  expiresAtMs: number;
}

export interface RoundWarmPoolOptions {
  provider: PanoramaProvider;
  intelligence: IntelligenceLookup;
  locate?: PanoramaLocator;
  /** Target number of pre-validated Round 1 entries to keep ready in memory. */
  maxSize?: number;
  /** Max lifetime of a pooled entry (aligned with weatherCache 15m TTL). */
  maxEntryAgeMs?: number;
  /** Minimum remaining weather validity before R03's 120m display cutoff. */
  weatherSafetyMarginMs?: number;
  /** Backoff after a failed fill attempt to avoid hammering upstream providers. */
  failureCooldownMs?: number;
  now?: () => number;
}

export interface RoundWarmPool {
  /** Ensure the pool is filling toward `maxSize` in the background. */
  warmUp(): Promise<void>;
  /**
   * Consume a fresh pre-validated Round 1 entry if available (or join an
   * already in-flight warm-up fetch), then trigger a background refill.
   */
  take(): Promise<{ target: PanoramaTarget; scene: RoundScene } | null>;
  /** Current number of non-expired entries buffered in memory. */
  size(): number;
}

const DEFAULT_POOL_SIZE = 3;
// Keep entries slightly under intelligence/service.ts's 15-minute weatherCache
// TTL so consuming a warm round also hits the weather cache on `/intelligence`.
const DEFAULT_MAX_ENTRY_AGE_MS = 14 * 60_000;
// Guarantee at least 15 minutes of remaining R03 validity (Easy timer is 7 min).
const DEFAULT_WEATHER_SAFETY_MARGIN_MS = 15 * 60_000;
const DEFAULT_FAILURE_COOLDOWN_MS = 15_000;

/**
 * Per-service bounded FIFO buffer of pre-validated Round 1 candidates.
 * Round 1 selection (`used = []`) is independent of difficulty, round count,
 * and user identity, so warming a tiny shared pool lets new games start
 * without waiting on upstream weather lookups or creating throwaway DB rows.
 */
export function createRoundWarmPool(
  options: RoundWarmPoolOptions,
): RoundWarmPool {
  const {
    provider,
    intelligence,
    locate,
    maxSize = DEFAULT_POOL_SIZE,
    maxEntryAgeMs = DEFAULT_MAX_ENTRY_AGE_MS,
    weatherSafetyMarginMs = DEFAULT_WEATHER_SAFETY_MARGIN_MS,
    failureCooldownMs = DEFAULT_FAILURE_COOLDOWN_MS,
    now = Date.now,
  } = options;

  const entries: WarmRoundEntry[] = [];
  let activeFetch: Promise<WarmRoundEntry | null> | null = null;
  let fillLoop: Promise<void> | null = null;
  let refillPending = false;
  let lastFailureAt = 0;
  let activated = false;

  function pruneExpired(): void {
    const current = now();
    let write = 0;
    for (let read = 0; read < entries.length; read += 1) {
      const entry = entries[read]!;
      if (entry.expiresAtMs > current) {
        entries[write] = entry;
        write += 1;
      }
    }
    entries.length = write;
  }

  function fetchOne(): Promise<WarmRoundEntry | null> {
    if (activeFetch) return activeFetch;
    const job = (async (): Promise<WarmRoundEntry | null> => {
      try {
        pruneExpired();
        const alreadyBuffered = entries.map((e) => e.target.targetIndex);
        const prepared = await selectRoundWithWeather(
          alreadyBuffered,
          provider,
          intelligence,
          { locate },
        );
        const current = now();
        const expiresAtMs = Math.min(
          prepared.weatherValidUntil.getTime() - weatherSafetyMarginMs,
          current + maxEntryAgeMs,
        );
        if (expiresAtMs <= current) return null;
        const entry: WarmRoundEntry = {
          target: prepared.target,
          scene: prepared.scene,
          expiresAtMs,
        };
        if (
          entries.length >= maxSize ||
          entries.some((e) => e.target.targetIndex === entry.target.targetIndex)
        ) {
          return null;
        }
        entries.push(entry);
        lastFailureAt = 0;
        return entry;
      } catch {
        lastFailureAt = now();
        return null;
      }
    })().finally(() => {
      activeFetch = null;
    });
    activeFetch = job;
    return job;
  }

  function warmUp(): Promise<void> {
    activated = true;
    pruneExpired();
    if (entries.length >= maxSize) return Promise.resolve();
    if (fillLoop) {
      refillPending = true;
      return fillLoop;
    }
    if (
      lastFailureAt > 0 &&
      entries.length === 0 &&
      now() - lastFailureAt < failureCooldownMs
    ) {
      return Promise.resolve();
    }

    fillLoop = (async () => {
      try {
        for (let attempt = 0; attempt < maxSize; attempt += 1) {
          pruneExpired();
          if (entries.length >= maxSize) break;
          const entry = await fetchOne();
          if (!entry) break;
        }
      } catch {
        // Best-effort: never allow background warm-up to crash the process.
      }
    })().finally(() => {
      const shouldRefill = refillPending;
      refillPending = false;
      fillLoop = null;
      if (shouldRefill && activated) {
        pruneExpired();
        if (entries.length < maxSize) void warmUp();
      }
    });

    return fillLoop;
  }

  async function take(): Promise<{
    target: PanoramaTarget;
    scene: RoundScene;
  } | null> {
    pruneExpired();
    if (entries.length === 0 && activeFetch) {
      await activeFetch;
      pruneExpired();
    }
    const entry = entries.shift();
    if (!entry) return null;
    if (activated) void warmUp();
    return { target: entry.target, scene: entry.scene };
  }

  function size(): number {
    pruneExpired();
    return entries.length;
  }

  return { warmUp, take, size };
}
