import { describe, expect, it } from 'vitest';
import {
  buildCandidates,
  findCandidateByPoint,
  resolveSelectionPoint,
  toPublicCandidates,
} from '../../src/modules/singleplayer/candidates.js';
import { LOCATION_CATALOG } from '../../src/modules/singleplayer/locations.js';
import { ROAD_TARGETS } from '../../src/modules/singleplayer/provider.js';

function indexOfCandidate(name: string): number {
  return LOCATION_CATALOG.findIndex((entry) => entry.name === name);
}

describe('easy-mode candidate list generation and validation', () => {
  it('always includes the actual target among the options with opaque round-scoped IDs', () => {
    const target = LOCATION_CATALOG[5]!;
    const first = buildCandidates(5, []);
    const second = buildCandidates(5, []);
    const match = first.find((c) => c.name === target.name);
    expect(match).toBeDefined();
    expect(match!.id).not.toBe('5');
    // Round-scoped IDs never repeat across rounds.
    expect(second.find((c) => c.name === target.name)?.id).not.toBe(match!.id);
  });

  it('returns 6 distinct, labeled options with real server coordinates and same-biome distractors', () => {
    const targetIndex = 20; // Desert entry
    const targetBiome = LOCATION_CATALOG[targetIndex]!.biome;
    const candidates = buildCandidates(targetIndex, []);
    expect(candidates).toHaveLength(6);
    const ids = new Set(candidates.map((c) => c.id));
    const names = new Set(candidates.map((c) => c.name));
    expect(ids.size).toBe(6);
    expect(names.size).toBe(6);
    let sameBiomeCount = 0;
    for (const candidate of candidates) {
      expect(candidate.name.length).toBeGreaterThan(0);
      const index = indexOfCandidate(candidate.name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(ROAD_TARGETS[index]).toEqual([candidate.lat, candidate.lon]);
      if (LOCATION_CATALOG[index]!.biome === targetBiome) sameBiomeCount += 1;
    }
    // Target + 3 same-biome distractors so the biome diorama never gives away the Easy answer.
    expect(sameBiomeCount).toBeGreaterThanOrEqual(4);
  });

  it('prefers unused locations as distractors when enough unused entries remain', () => {
    const used = [1, 2, 3, 4];
    const candidates = buildCandidates(0, used);
    for (const candidate of candidates) {
      const idx = indexOfCandidate(candidate.name);
      if (idx === 0) continue;
      expect(used).not.toContain(idx);
    }
  });

  it('shuffles the target position across rounds', () => {
    const targetName = LOCATION_CATALOG[3]!.name;
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const candidates = buildCandidates(3, []);
      positions.add(candidates.findIndex((c) => c.name === targetName));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('guarantees 6 distinct options even when nearly all or all catalog targets were already used', () => {
    const target = LOCATION_CATALOG[0]!;
    const almostAllUsed = ROAD_TARGETS.map((_, i) => i).filter((i) => i !== 0);
    const fullCycleUsed = ROAD_TARGETS.map((_, i) => i);

    for (const used of [almostAllUsed, fullCycleUsed]) {
      const candidates = buildCandidates(0, used);
      expect(candidates).toHaveLength(6);
      expect(new Set(candidates.map((c) => c.name)).size).toBe(6);
      expect(new Set(candidates.map((c) => c.id)).size).toBe(6);
      expect(candidates.some((c) => c.name === target.name)).toBe(true);
      const sameBiomeCount = candidates.filter(
        (c) => LOCATION_CATALOG[indexOfCandidate(c.name)]!.biome === target.biome,
      ).length;
      expect(sameBiomeCount).toBeGreaterThanOrEqual(4);
    }
  });

  it('projects candidate coordinates for the Easy map and enforces list membership server-side', () => {
    const stored = buildCandidates(0, []);
    const pub = toPublicCandidates(stored)!;
    expect(pub).toHaveLength(6);
    for (const [index, entry] of pub.entries()) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'lat', 'lon', 'name', 'region']);
      expect(entry.lat).toBe(stored[index]!.lat);
      expect(entry.lon).toBe(stored[index]!.lon);
    }

    const chosen = stored[2]!;
    expect(resolveSelectionPoint('list', { candidateId: chosen.id }, stored)).toEqual({
      lat: chosen.lat,
      lon: chosen.lon,
    });
    expect(findCandidateByPoint(stored, chosen.lat, chosen.lon)?.id).toBe(chosen.id);

    expect(() =>
      resolveSelectionPoint('list', { lat: chosen.lat, lon: chosen.lon }, stored),
    ).toThrow(/Easy mode requires/i);
    expect(() =>
      resolveSelectionPoint('list', { candidateId: 'not-in-round' }, stored),
    ).toThrow(/not one of the choices/i);
    expect(() =>
      resolveSelectionPoint('map', { candidateId: chosen.id }, null),
    ).toThrow(/Map mode requires/i);
    expect(resolveSelectionPoint('map', { lat: 12.3, lon: 45.6 }, null)).toEqual({
      lat: 12.3,
      lon: 45.6,
    });
  });
});
