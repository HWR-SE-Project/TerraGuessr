import { describe, expect, it } from 'vitest';
import { gameRulesFor } from '../../src/domain/gameRules.js';
import {
  applyPointPenalty,
  applyTimePenalty,
  decideAttempt,
  isDeadlinePassed,
} from '../../src/domain/roundFlow.js';
import {
  computeScore,
  formatEvaluatedAttempts,
} from '../../src/domain/roundView.js';

describe('difficulty game rules', () => {
  it('defines the same difficulty contract for every mode', () => {
    expect(gameRulesFor('easy')).toMatchObject({
      timeLimitSeconds: 420,
      attemptsPerRound: 3,
      selectionMode: 'list',
      extraData: { mode: 'free' },
    });
    expect(gameRulesFor('medium')).toMatchObject({
      timeLimitSeconds: 240,
      attemptsPerRound: 2,
      selectionMode: 'map',
      extraData: { mode: 'points', cost: 100 },
    });
    expect(gameRulesFor('hard')).toMatchObject({
      timeLimitSeconds: 120,
      attemptsPerRound: 1,
      selectionMode: 'map',
      extraData: { mode: 'time', cost: 20 },
    });
    for (const difficulty of ['easy', 'medium', 'hard'])
      expect(gameRulesFor(difficulty).countryBorders).toBe(true);
  });
  it('falls back to medium for unknown values', () => {
    expect(gameRulesFor('expert')).toEqual(gameRulesFor('medium'));
  });
});

describe('round attempt lifecycle decisions', () => {
  const base = {
    attemptsUsed: 0,
    attemptsTotal: 3,
    requestedFinal: false,
    finalized: false,
    deadlinePassed: false,
  };

  it('keeps a non-final attempt open while attempts remain', () => {
    expect(decideAttempt(base)).toEqual({
      allowed: true,
      attemptNumber: 1,
      finalizes: false,
      attemptsRemaining: 2,
    });
  });
  it('finalizes on an explicit final submission', () => {
    expect(decideAttempt({ ...base, requestedFinal: true })).toMatchObject({
      allowed: true,
      finalizes: true,
      attemptsRemaining: 2,
    });
  });
  it('finalizes when the attempt budget is exhausted', () => {
    expect(decideAttempt({ ...base, attemptsUsed: 2 })).toMatchObject({
      allowed: true,
      attemptNumber: 3,
      finalizes: true,
      attemptsRemaining: 0,
    });
  });
  it('rejects submissions after the deadline, finalization or exhaustion', () => {
    expect(decideAttempt({ ...base, deadlinePassed: true })).toEqual({
      allowed: false,
      reason: 'deadline',
    });
    expect(decideAttempt({ ...base, finalized: true })).toEqual({
      allowed: false,
      reason: 'finalized',
    });
    expect(decideAttempt({ ...base, attemptsUsed: 3 })).toEqual({
      allowed: false,
      reason: 'exhausted',
    });
  });
});

describe('extra-data point and time penalties', () => {
  it('never deducts below zero points', () => {
    expect(applyPointPenalty(5000, 100)).toBe(4900);
    expect(applyPointPenalty(40, 100)).toBe(0);
  });
  it('shortens the deadline and never moves it into the past', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    expect(
      applyTimePenalty(new Date('2026-11-21T12:02:00Z'), 20, now).toISOString(),
    ).toBe('2026-11-21T12:01:40.000Z');
    expect(
      applyTimePenalty(new Date('2026-11-21T12:00:10Z'), 20, now).toISOString(),
    ).toBe(now.toISOString());
  });
  it('detects deadlines consistently', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    expect(isDeadlinePassed('2026-11-21T12:00:00Z', now)).toBe(true);
    expect(isDeadlinePassed('2026-11-21T12:00:01Z', now)).toBe(false);
    expect(isDeadlinePassed(null, now)).toBe(false);
  });
});

describe('best-of-N attempt scoring', () => {
  const actual = { lat: 48.8566, lon: 2.3522 }; // Paris
  const close = {
    id: 'a1',
    attemptNumber: 1,
    guessLat: 51.5074,
    guessLon: -0.1278,
    distanceKm: 343.5,
    score: 4939,
    createdAt: new Date('2026-11-24T12:00:00Z'),
  };
  const far = {
    id: 'a2',
    attemptNumber: 2,
    guessLat: 35.6762,
    guessLon: 139.6503,
    distanceKm: 9713.0,
    score: 2584,
    createdAt: new Date('2026-11-24T12:01:00Z'),
  };

  it('scores the closest submitted attempt on both explicit completion and timeout', () => {
    const onFinal = computeScore({
      attempts: [close, far],
      selection: { lat: 0, lon: 0 },
      actual,
      pointsSpent: 100,
      timedOut: false,
    });
    const onTimeout = computeScore({
      attempts: [close, far],
      selection: { lat: 0, lon: 0 },
      actual,
      pointsSpent: 100,
      timedOut: true,
    });

    expect(onFinal.guess).toEqual({ lat: close.guessLat, lon: close.guessLon });
    expect(onTimeout).toEqual(onFinal);
    expect(onFinal.score).toBeLessThanOrEqual(4900);

    const formatted = formatEvaluatedAttempts([far, close]);
    expect(formatted.map((a) => ({ n: a.attemptNumber, isBest: a.isBest }))).toEqual([
      { n: 1, isBest: true },
      { n: 2, isBest: false },
    ]);
  });

  it('falls back to the latest selection on a zero-attempt timeout, or zero when empty', () => {
    const withSelection = computeScore({
      attempts: [],
      selection: actual,
      actual,
      pointsSpent: 0,
      timedOut: true,
    });
    expect(withSelection).toMatchObject({ guess: actual, distanceKm: 0, score: 5000 });

    const empty = computeScore({
      attempts: [],
      selection: null,
      actual,
      pointsSpent: 0,
      timedOut: true,
    });
    expect(empty).toEqual({ guess: null, distanceKm: null, score: 0 });
  });
});
