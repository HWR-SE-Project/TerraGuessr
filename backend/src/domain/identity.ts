/**
 * Display-name normalization (ADR / R16).
 *
 * Different modules used to apply their own idea of a "valid display name":
 * lobbies trimmed and mapped blanks to null, account creation trimmed and
 * enforced a 2–40 length, profile updates only trimmed, and the Google
 * callback built a fallback name. This is the single source of truth.
 */

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;

/**
 * Normalize a free-form display name: trim surrounding whitespace and map a
 * blank/absent value to `null` (rendered 'Guest' client-side). Lobbies use
 * this, since a guest display name is optional.
 */
export function normalizeDisplayName(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Account-creation validation: a registered display name must be 2–40
 * characters after trimming. Returns false (rather than throwing) so the
 * caller can raise its own domain error with the right status code.
 */
export function isValidDisplayName(raw: string): boolean {
  const trimmed = raw.trim();
  return (
    trimmed.length >= DISPLAY_NAME_MIN_LENGTH &&
    trimmed.length <= DISPLAY_NAME_MAX_LENGTH
  );
}
