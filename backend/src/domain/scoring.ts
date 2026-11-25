/**
 * Score curve (R10).
 *
 * Pure domain code: no I/O, no clock access, no randomness.
 */

import { haversineKm, type LatLon } from './distance.js';

/** Maximum points awarded for a perfect guess. */
export const MAX_SCORE = 5000;

/** R10 boundary: up to this many kilometres (R9-rounded) still scores MAX_SCORE. */
export const FULL_SCORE_KM = 100;

/** R10 boundary: at least this many kilometres scores 0. */
export const ZERO_SCORE_KM = 20000;

/**
 * R10 scoring: linear decay from `FULL_SCORE_KM` to `ZERO_SCORE_KM`, applied to
 * the R9-rounded (one-decimal) distance so the boundary values match what the
 * player sees.
 *
 * @param km distance between guess and actual location, in kilometres
 * @returns integer score in [0, 5000]; non-increasing as distance grows
 */
export function scoreForDistance(km: number): number {
  if (Number.isNaN(km)) {
    return 0;
  }

  // R09/R10: the boundary is defined on the one-decimal displayed distance.
  const roundedKm = Math.round(km * 10) / 10;
  if (roundedKm <= FULL_SCORE_KM) return MAX_SCORE;
  if (roundedKm >= ZERO_SCORE_KM) return 0;

  const span = ZERO_SCORE_KM - FULL_SCORE_KM;
  const raw = (MAX_SCORE * (ZERO_SCORE_KM - roundedKm)) / span;
  // Floor (not round) so the score drops immediately past the 100 km boundary
  // instead of staying at 5000 through the first few kilometres of decay.
  return Math.floor(Math.min(MAX_SCORE, Math.max(0, raw)));
}

/** Evaluate a guess before any round-level point deductions. */
export function evaluateGuess(guess: LatLon, actual: LatLon) {
  const distanceKm = haversineKm(guess, actual);
  return { distanceKm, score: scoreForDistance(distanceKm) };
}
