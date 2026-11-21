/**
 * Pure round-lifecycle decisions shared by singleplayer and multiplayer (R02).
 *
 * Storage and transport stay mode-specific, but "may this attempt be accepted,
 * does it finalize the round, and what does the deadline do to it" must not
 * diverge between modes.
 */

export type AttemptRejection = 'deadline' | 'exhausted' | 'finalized';

export type AttemptDecision =
  | { allowed: false; reason: AttemptRejection }
  | {
      allowed: true;
      attemptNumber: number;
      /** True when this attempt ends the round. */
      finalizes: boolean;
      attemptsRemaining: number;
    };

export interface AttemptDecisionInput {
  attemptsUsed: number;
  attemptsTotal: number;
  requestedFinal: boolean;
  finalized: boolean;
  deadlinePassed: boolean;
}

/** Decide whether a guess may be recorded and whether it ends the round. */
export function decideAttempt(input: AttemptDecisionInput): AttemptDecision {
  if (input.finalized) return { allowed: false, reason: 'finalized' };
  if (input.deadlinePassed) return { allowed: false, reason: 'deadline' };
  if (input.attemptsUsed >= input.attemptsTotal)
    return { allowed: false, reason: 'exhausted' };

  const attemptNumber = input.attemptsUsed + 1;
  const finalizes =
    input.requestedFinal || attemptNumber >= input.attemptsTotal;
  return {
    allowed: true,
    attemptNumber,
    finalizes,
    attemptsRemaining: input.attemptsTotal - attemptNumber,
  };
}

/** True when the round deadline has been reached. */
export function isDeadlinePassed(
  endsAt: Date | string | null | undefined,
  now: Date,
): boolean {
  if (!endsAt) return false;
  const deadline = endsAt instanceof Date ? endsAt : new Date(endsAt);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() <= now.getTime();
}

/** R10: extra-data point costs reduce a round score, never below zero. */
export function applyPointPenalty(score: number, pointsSpent: number): number {
  return Math.max(0, score - Math.max(0, pointsSpent));
}

/**
 * R05 Hard: unlocking additional data deducts seconds from the current round.
 * The deadline never moves backwards past `now`.
 */
export function applyTimePenalty(
  endsAt: Date,
  seconds: number,
  now: Date,
): Date {
  const shortened = new Date(endsAt.getTime() - Math.max(0, seconds) * 1000);
  return shortened.getTime() < now.getTime() ? now : shortened;
}
