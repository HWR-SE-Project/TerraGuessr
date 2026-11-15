import { describe, expect, it } from 'vitest';
import { calculateDailyStreaks } from './streaks.js';

describe('calculateDailyStreaks', () => {
  it('calculates current and longest streak in UTC', () => {
    expect(calculateDailyStreaks(['2026-11-12', '2026-11-13', '2026-11-14'], '2026-11-15')).toEqual({ current: 3, longest: 3 });
    expect(calculateDailyStreaks(['2026-11-11', '2026-11-12', '2026-11-14', '2026-11-15'], '2026-11-15')).toEqual({ current: 2, longest: 2 });
  });

  it('preserves a best streak and expires the current streak after a missed UTC day', () => {
    expect(calculateDailyStreaks(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-15'], '2026-11-15')).toEqual({ current: 1, longest: 3 });
    expect(calculateDailyStreaks(['2026-11-10'], '2026-11-12')).toEqual({ current: 0, longest: 1 });
    expect(calculateDailyStreaks([], '2026-11-12')).toEqual({ current: 0, longest: 0 });
  });
});
