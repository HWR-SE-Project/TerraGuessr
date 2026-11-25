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

/** Street View session TTL: a game expires 24h after creation (endless mode). */
export const STREET_GAME_TTL_MS = 24 * 60 * 60 * 1000;

/** Shared finite round-count bounds used by both multiplayer lobbies and singleplayer games. */
export const MIN_ROUNDS_TOTAL = 3;
export const MAX_ROUNDS_TOTAL = 10;
export const DEFAULT_ROUNDS_TOTAL = 5;

/** Lobby (R16) defaults. Difficulty controls rules; the host sets the round count. */
export const LOBBY_CODE_LENGTH = 6;
export const LOBBY_ROUNDS_TOTAL = DEFAULT_ROUNDS_TOTAL;
export const MAX_LOBBY_MEMBERS = 16;
export const LOBBY_TTL_MS = 2 * 60 * 60 * 1000;
export const LOBBY_ROUND_REVIEW_MS = 5_000;

/**
 * Once a player requests a rematch after the final round, other players get
 * this long to join the rematch before unresponsive members are removed so
 * continuing players never wait indefinitely. While nobody requests a rematch,
 * final standings remain visible until the lobby TTL expires (R16).
 */
export const LOBBY_CONTINUE_WINDOW_MS = 30 * 1000;

/**
 * Shared rate-limit presets (Phase C). The same tuples were scattered across
 * singleplayer, lobby and results routes; keeping them here stops the
 * per-endpoint limits from drifting independently.
 */
export const RATE_LIMITS = {
  /** Baseline global limit for routes without a stricter per-route override. */
  globalDefault: { max: 240, timeWindow: '1 minute' },
  /** Multiplayer waiting-room & active-match polling (1–1.5s cadence, NAT-safe). */
  poll: { max: 180, timeWindow: '1 minute' },
  /** Standard game-scoped reads/writes. */
  standard: { max: 30, timeWindow: '1 minute' },
  /** Light authenticated reads (results history, lobby reads). */
  read: { max: 60, timeWindow: '1 minute' },
  /** High-frequency anonymous mutations (joins, selections, guesses). */
  write: { max: 120, timeWindow: '1 minute' },
  /** Interactive pin/city selection changes during an active round (R08). */
  selection: { max: 240, timeWindow: '1 minute' },
} as const;
