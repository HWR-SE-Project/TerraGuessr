/**
 * Score curve (R10).
 *
 * Pure domain code: no I/O, no clock access, no randomness.
 */

/** Maximum points awarded for a perfect guess. */
export const MAX_SCORE = 5000;

/** Distance in km at which the score decays to MAX_SCORE / e (~1839 points). */
export const SCORE_DECAY_KM = 2000;

/**
 * Score for a given distance: 5000 * exp(-km / 2000), rounded and clamped
 * to [0, 5000].
 *
 * @param km distance between guess and actual location, in kilometres
 * @returns integer score in [0, 5000]; non-increasing as distance grows
 */
export function scoreForDistance(km: number): number {
  if (Number.isNaN(km)) {
    return 0;
  }

  const raw = MAX_SCORE * Math.exp(-km / SCORE_DECAY_KM);
  return Math.round(Math.min(MAX_SCORE, Math.max(0, raw)));
}
