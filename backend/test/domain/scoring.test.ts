import { describe, expect, it } from 'vitest';

import { MAX_SCORE, scoreForDistance } from '../../src/domain/scoring.js';

describe('scoreForDistance', () => {
  it('awards the maximum score for a perfect guess (0 km -> 5000)', () => {
    expect(scoreForDistance(0)).toBe(5000);
  });

  it('awards 1839 points at 2000 km', () => {
    expect(scoreForDistance(2000)).toBe(1839);
  });

  it('awards 34 points at 10000 km', () => {
    expect(scoreForDistance(10000)).toBe(34);
  });

  it('awards 0 points at the rounding boundary (18421 km)', () => {
    expect(scoreForDistance(18421)).toBe(0);
  });

  it('awards 0 points beyond the rounding boundary (20015 km)', () => {
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
