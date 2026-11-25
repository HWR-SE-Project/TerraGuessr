import { describe, expect, it } from 'vitest';

import { MAX_SCORE, scoreForDistance } from '../../src/domain/scoring.js';

describe('scoreForDistance', () => {
  it('awards the maximum score for a perfect guess (0 km -> 5000)', () => {
    expect(scoreForDistance(0)).toBe(5000);
  });

  it('awards the maximum score for any distance up to 100 km', () => {
    expect(scoreForDistance(100)).toBe(5000);
    expect(scoreForDistance(50)).toBe(5000);
  });

  it('evaluates the 100 km full-score threshold after rounding distance to one decimal place', () => {
    // 100.04 km rounds to 100.0 km and still scores the maximum.
    expect(scoreForDistance(100.04)).toBe(5000);
    // 100.05 km rounds to 100.1 km and drops below the maximum.
    expect(scoreForDistance(100.05)).toBeLessThan(5000);
  });

  it('decays linearly between the boundaries', () => {
    expect(scoreForDistance(2000)).toBe(4522);
    expect(scoreForDistance(10000)).toBe(2512);
  });

  it('awards 0 points at and beyond 20000 km', () => {
    expect(scoreForDistance(20000)).toBe(0);
    expect(scoreForDistance(20015)).toBe(0);
  });

  it('exposes 5000 as the maximum score', () => {
    expect(MAX_SCORE).toBe(5000);
  });

  it('is monotonically non-increasing over 0..20100 km', () => {
    let previous = scoreForDistance(0);

    for (let km = 1; km <= 20100; km += 1) {
      const score = scoreForDistance(km);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });

  it('never leaves the [0, 5000] range over 0..20100 km', () => {
    for (let km = 0; km <= 20100; km += 1) {
      const score = scoreForDistance(km);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5000);
    }
  });
});
