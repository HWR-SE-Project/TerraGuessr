/**
 * R03: displayed weather data must never be older than 120 minutes, regardless
 * of how long an inactive round stays open.
 */
export const WEATHER_MAX_DISPLAY_AGE_MS = 120 * 60 * 1000;

/**
 * R13: a location is invalid if its weather cannot be retrieved within 3
 * seconds, or if the retry budget (3 locations per round) is exhausted.
 */
export const WEATHER_FETCH_TIMEOUT_MS = 3000;
export const MAX_WEATHER_LOCATION_ATTEMPTS = 3;

/**
 * R01: a newly selected target must not land within this radius of the
 * immediately preceding one, so consecutive rounds don't feel geographically
 * repetitive even when the fixed target pool has nearby entries.
 */
export const MIN_TARGET_SEPARATION_FROM_RECENT_KM = 400;

/** R18 retention window: results older than 6 months (180 days) are purged. */
export const PURGE_RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/** Street View session TTL: a game expires 24h after creation (endless mode). */
export const STREET_GAME_TTL_MS = 24 * 60 * 60 * 1000;

/** Lobby (R16) defaults. Difficulty controls rules; the host sets the round count. */
export const LOBBY_CODE_LENGTH = 6;
export const LOBBY_ROUNDS_TOTAL = 5;
export const LOBBY_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * After the final round, players get this long to choose "continue" or leave.
 * Anyone who has not chosen by the deadline is removed from the lobby so the
 * remaining players never wait indefinitely.
 */
export const LOBBY_CONTINUE_WINDOW_MS = 30 * 1000;

/**
 * Shared rate-limit presets (Phase C). The same tuples were scattered across
 * singleplayer, lobby and results routes; keeping them here stops the
 * per-endpoint limits from drifting independently.
 */
export const RATE_LIMITS = {
  /** Standard game-scoped reads/writes. */
  standard: { max: 30, timeWindow: '1 minute' },
  /** Light authenticated reads (results history, lobby reads). */
  read: { max: 60, timeWindow: '1 minute' },
  /** High-frequency anonymous mutations (joins, selections, guesses). */
  write: { max: 120, timeWindow: '1 minute' },
} as const;
