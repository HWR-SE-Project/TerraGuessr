import { describe, expect, it } from 'vitest';
import { buildCandidates } from '../../src/modules/singleplayer/candidates.js';
import { ROAD_TARGETS } from '../../src/modules/singleplayer/provider.js';

describe('buildCandidates (R05 easy difficulty, R07 list selection)', () => {
  it('always includes the actual target among the options', () => {
    const candidates = buildCandidates(5, []);
    expect(candidates.some((c) => c.id === '5')).toBe(true);
  });

  it('returns 6 distinct, labeled options with real coordinates', () => {
    const candidates = buildCandidates(0, []);
    expect(candidates).toHaveLength(6);
    const ids = new Set(candidates.map((c) => c.id));
    expect(ids.size).toBe(6);
    for (const candidate of candidates) {
      expect(candidate.name.length).toBeGreaterThan(0);
      const index = Number(candidate.id);
      expect(ROAD_TARGETS[index]).toEqual([candidate.lat, candidate.lon]);
    }
  });

  it('never offers an already-used location as a distractor', () => {
    const used = [1, 2, 3, 4];
    const candidates = buildCandidates(0, used);
    for (const candidate of candidates) {
      if (candidate.id === '0') continue;
      expect(used).not.toContain(Number(candidate.id));
    }
  });

  it('does not always place the answer in the same position (shuffled, R04)', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const candidates = buildCandidates(3, []);
      positions.add(candidates.findIndex((c) => c.id === '3'));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('degrades gracefully when the unused pool is smaller than the usual count', () => {
    const used = ROAD_TARGETS.map((_, i) => i).filter((i) => i !== 0 && i !== 1);
    const candidates = buildCandidates(0, used);
    expect(candidates.length).toBeLessThanOrEqual(2);
    expect(candidates.some((c) => c.id === '0')).toBe(true);
  });
});
