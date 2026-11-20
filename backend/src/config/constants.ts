export const ROUNDS_PER_GAME = 5;
export const EASY_CANDIDATES = 5;
export const MEDIUM_CANDIDATES = 8;
export const MIN_SEPARATION_KM = 500;
export const MAX_SELECTION_TRIES = 10;
export const WEATHER_TTL_MS = 3600000;

/** Open-Meteo request timeout (Phase C hardening): never hang a round-start. */
export const WEATHER_FETCH_TIMEOUT_MS = 5000;

/** R18 retention window: results older than 6 months (180 days) are purged. */
export const PURGE_RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000;
export const EARTH_RADIUS_KM = 6371.0088;

/** Lobby (R16) defaults. Difficulty controls rules; rounds/size stay fixed. */
export const LOBBY_CODE_LENGTH = 6;
export const LOBBY_MAX_PLAYERS = 8;
export const LOBBY_ROUNDS_TOTAL = 5;
export const LOBBY_TTL_MS = 2 * 60 * 60 * 1000;
