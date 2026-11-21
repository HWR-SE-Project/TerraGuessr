export const WEATHER_TTL_MS = 3600000;

/**
 * R03: displayed weather data must never be older than 120 minutes, regardless
 * of how long an inactive round stays open.
 */
export const WEATHER_MAX_DISPLAY_AGE_MS = 120 * 60 * 1000;

/** Open-Meteo request timeout (Phase C hardening): never hang a round-start. */
export const WEATHER_FETCH_TIMEOUT_MS = 5000;

/** R18 retention window: results older than 6 months (180 days) are purged. */
export const PURGE_RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000;
export const EARTH_RADIUS_KM = 6371.0088;

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
