import { describe, expect, it } from 'vitest';
import { gameRulesFor } from '../../src/domain/gameRules.js';
import {
  applyPointPenalty,
  applyTimePenalty,
  decideAttempt,
  isDeadlinePassed,
} from '../../src/domain/roundFlow.js';

describe('shared game rules (R05)', () => {
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

describe('shared attempt decisions (R02)', () => {
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

describe('shared penalties (R05/R10)', () => {
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
