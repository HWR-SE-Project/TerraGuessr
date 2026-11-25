import { describe, expect, it } from 'vitest';

import {
  computeElapsedSeconds,
  computeMatchPlacements,
  extractSceneMetadata,
} from '../../src/domain/archive.js';
import {
  computePlayerStatistics,
  type StatisticsRow,
} from '../../src/domain/statistics.js';

const NOW = new Date('2026-11-25T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, hour = 10): Date {
  const base = new Date(NOW.getTime() - days * DAY_MS);
  base.setUTCHours(hour, 0, 0, 0);
  return base;
}

function makeRow(overrides: Partial<StatisticsRow> & { id: string }): StatisticsRow {
  return {
    mode: 'solo',
    difficulty: 'medium',
    matchId: 'match-1',
    roundNumber: 1,
    guessLat: 48.8,
    guessLon: 2.3,
    distanceKm: 150,
    score: 4980,
    placeName: null,
    biome: null,
    weather: null,
    temperatureBand: null,
    attemptsUsed: null,
    extraDataUnlocked: null,
    extraDataPointsSpent: null,
    elapsedSeconds: null,
    matchPlacement: null,
    matchPlayerCount: null,
    createdAt: daysAgo(1),
    ...overrides,
  };
}

describe('archive enrichment helpers', () => {
  it('extracts valid scene metadata and ignores invalid/missing JSON', () => {
    expect(
      extractSceneMetadata({
        biome: 'desert',
        weather: 'storm',
        temperatureBand: 'hot',
      }),
    ).toEqual({
      biome: 'desert',
      weather: 'storm',
      temperatureBand: 'hot',
    });

    expect(extractSceneMetadata({ biome: 'volcano', weather: 42 })).toEqual({
      biome: null,
      weather: null,
      temperatureBand: null,
    });
    expect(extractSceneMetadata(null)).toEqual({
      biome: null,
      weather: null,
      temperatureBand: null,
    });
  });

  it('computes clamped elapsed seconds and uses time limit on timeout', () => {
    const start = new Date('2026-11-25T10:00:00.000Z');
    const end = new Date('2026-11-25T10:01:25.400Z');
    expect(computeElapsedSeconds(start, end, 240, false)).toBe(85);
    expect(computeElapsedSeconds(start, new Date('2026-11-25T10:15:00.000Z'), 240, false)).toBe(240);
    expect(computeElapsedSeconds(null, end, 240, true)).toBe(240);
    expect(computeElapsedSeconds(null, end, 240, false)).toBeNull();
  });

  it('computes competition rankings for multiplayer matches with ties and guests', () => {
    const placements = computeMatchPlacements(
      [
        { id: 'm1', userId: 'u1', displayName: 'Alice' },
        { id: 'm2', userId: null, displayName: 'Guest' },
        { id: 'm3', userId: 'u3', displayName: 'Bob' },
        { id: 'm4', userId: 'u4', displayName: 'Cara' },
      ],
      [
        { memberId: 'm1', score: 4500 },
        { memberId: 'm1', score: 4500 }, // 9000
        { memberId: 'm2', score: 9000 }, // 9000 tie for #1
        { memberId: 'm3', score: 7000 }, // #3
        { memberId: 'm4', score: 4000 }, // #4
      ],
    );
    expect(placements).toEqual([
      { userId: 'u1', placement: 1, playerCount: 4 },
      { userId: 'u3', placement: 3, playerCount: 4 },
      { userId: 'u4', placement: 4, playerCount: 4 },
    ]);
  });
});

describe('computePlayerStatistics', () => {
  it('returns safe empty statistics when user has no retained rounds', () => {
    const stats = computePlayerStatistics([], {
      period: '30d',
      mode: 'all',
      difficulty: 'all',
      now: NOW,
    });
    expect(stats.totalRetainedRounds).toBe(0);
    expect(stats.kpis.roundsPlayed).toBe(0);
    expect(stats.kpis.averageScore).toBeNull();
    expect(stats.kpis.medianDistanceKm).toBeNull();
    expect(stats.personalBests.bestRound).toBeNull();
    expect(stats.trend.points).toEqual([]);
    expect(stats.environment.sampleSize).toBe(0);
    expect(stats.explorerProfile).toEqual([]);
  });

  it('computes period KPIs, median vs mean distance, deltas, and 6m null deltas', () => {
    const rows: StatisticsRow[] = [
      // Current 7d window (3 rounds, 2 matches)
      makeRow({ id: 'c1', matchId: 'm-c1', score: 5000, distanceKm: 20, placeName: 'Paris', createdAt: daysAgo(1) }),
      makeRow({ id: 'c2', matchId: 'm-c1', score: 4000, distanceKm: 400, placeName: 'Rome', createdAt: daysAgo(2) }),
      makeRow({ id: 'c3', matchId: 'm-c2', score: 0, distanceKm: null, guessLat: null, guessLon: null, createdAt: daysAgo(3) }),
      // Previous 7d window (2 rounds, 1 match)
      makeRow({ id: 'p1', matchId: 'm-p1', score: 3000, distanceKm: 1000, createdAt: daysAgo(9) }),
      makeRow({ id: 'p2', matchId: 'm-p1', score: 2000, distanceKm: 3000, createdAt: daysAgo(10) }),
    ];

    const stats7d = computePlayerStatistics(rows, {
      period: '7d',
      mode: 'all',
      difficulty: 'all',
      now: NOW,
    });

    expect(stats7d.hasPreviousPeriod).toBe(true);
    expect(stats7d.kpis.roundsPlayed).toBe(3);
    expect(stats7d.kpis.matchesPlayed).toBe(2);
    expect(stats7d.kpis.averageScore).toBe(3000);
    expect(stats7d.kpis.medianDistanceKm).toBe(210);
    expect(stats7d.kpis.averageDistanceKm).toBe(210);
    expect(stats7d.kpis.perfectCount).toBe(1);
    expect(stats7d.kpis.perfectRate).toBe(33.3);
    expect(stats7d.kpis.timeoutCount).toBe(1);
    expect(stats7d.kpis.timeoutRate).toBe(33.3);
    // Previous avg score was 2500 -> +500 delta
    expect(stats7d.kpis.deltas.averageScore).toBe(500);
    expect(stats7d.kpis.deltas.roundsPlayed).toBe(1);
    expect(stats7d.personalBests.bestRound?.placeName).toBe('Paris');
    expect(stats7d.personalBests.bestMatch?.matchId).toBe('m-c1');

    const stats6m = computePlayerStatistics(rows, {
      period: '6m',
      mode: 'all',
      difficulty: 'all',
      now: NOW,
    });
    expect(stats6m.hasPreviousPeriod).toBe(false);
    expect(stats6m.kpis.deltas.averageScore).toBeNull();
    expect(stats6m.trend.granularity).toBe('week');
  });

  it('degrades gracefully on mixed legacy (null) and enriched rows, and computes MP & strategy stats', () => {
    const rows: StatisticsRow[] = [
      // Legacy row (all enriched fields null)
      makeRow({
        id: 'legacy-1',
        matchId: 'solo-old',
        mode: 'solo',
        difficulty: 'easy',
        score: 5000,
        distanceKm: 50,
        createdAt: daysAgo(5),
      }),
      // Enriched solo rows
      makeRow({
        id: 'e1',
        matchId: 'solo-new',
        mode: 'solo',
        difficulty: 'medium',
        score: 5000,
        distanceKm: 35,
        placeName: 'Oslo',
        biome: 'forest',
        weather: 'snow',
        temperatureBand: 'freezing',
        attemptsUsed: 1,
        extraDataUnlocked: true,
        extraDataPointsSpent: 100,
        elapsedSeconds: 45,
        createdAt: daysAgo(2),
      }),
      makeRow({
        id: 'e2',
        matchId: 'solo-new',
        mode: 'solo',
        difficulty: 'medium',
        score: 4800,
        distanceKm: 300,
        placeName: 'Cairo',
        biome: 'desert',
        weather: 'clear',
        temperatureBand: 'hot',
        attemptsUsed: 2,
        extraDataUnlocked: false,
        extraDataPointsSpent: 0,
        elapsedSeconds: 95,
        createdAt: daysAgo(1),
      }),
      // Enriched completed multiplayer match (#1 of 4)
      makeRow({
        id: 'mp1-r1',
        matchId: 'mp-1',
        mode: 'multiplayer',
        difficulty: 'hard',
        roundNumber: 1,
        score: 4500,
        distanceKm: 600,
        biome: 'desert',
        weather: 'clear',
        temperatureBand: 'hot',
        attemptsUsed: 1,
        extraDataUnlocked: false,
        extraDataPointsSpent: 0,
        elapsedSeconds: 60,
        matchPlacement: 1,
        matchPlayerCount: 4,
        createdAt: daysAgo(0, 8),
      }),
      makeRow({
        id: 'mp1-r2',
        matchId: 'mp-1',
        mode: 'multiplayer',
        difficulty: 'hard',
        roundNumber: 2,
        score: 5000,
        distanceKm: 40,
        biome: 'forest',
        weather: 'rain',
        temperatureBand: 'mild',
        attemptsUsed: 1,
        extraDataUnlocked: true,
        extraDataPointsSpent: 0,
        elapsedSeconds: 50,
        matchPlacement: 1,
        matchPlayerCount: 4,
        createdAt: daysAgo(0, 9),
      }),
      // Abandoned multiplayer match (matchPlacement null -> must not count as win/loss)
      makeRow({
        id: 'mp2-r1',
        matchId: 'mp-abandoned',
        mode: 'multiplayer',
        difficulty: 'hard',
        roundNumber: 1,
        score: 2000,
        distanceKm: 5000,
        matchPlacement: null,
        matchPlayerCount: null,
        createdAt: daysAgo(0, 10),
      }),
    ];

    const stats = computePlayerStatistics(rows, {
      period: '30d',
      mode: 'all',
      difficulty: 'all',
      now: NOW,
    });

    // Streaks: daysAgo(2), daysAgo(1), daysAgo(0) => 3-day active streak
    expect(stats.consistency.currentPlayStreakDays).toBe(3);
    expect(stats.consistency.bestPlayStreakDays).toBe(3);
    expect(stats.consistency.bestPerfectStreak).toBe(2);
    expect(stats.consistency.tier).not.toBeNull();

    // Multiplayer: only mp-1 has placement
    expect(stats.multiplayer.finishedMatches).toBe(1);
    expect(stats.multiplayer.wins).toBe(1);
    expect(stats.multiplayer.winRate).toBe(100);
    expect(stats.multiplayer.podiumRate).toBe(100);

    // Environment sample size excludes legacy + abandoned rows with null biome/weather
    expect(stats.environment.sampleSize).toBe(4);
    expect(stats.environment.byBiome.map((b) => b.key)).toEqual(['forest', 'desert']);

    // Strategy sample sizes exclude legacy rows
    expect(stats.strategy.elapsedSampleSize).toBe(4);
    expect(stats.strategy.hintsSampleSize).toBe(4);
    expect(stats.strategy.hints.unlockedRounds).toBe(2);
    expect(stats.strategy.hints.notUnlockedRounds).toBe(2);
    expect(stats.strategy.hints.usageRate).toBe(50);
    expect(stats.strategy.hints.totalPointsSpent).toBe(100);

    // Accuracy bands add up to total rounds
    const totalBandCount = stats.accuracyDistribution.reduce((s, b) => s + b.count, 0);
    expect(totalBandCount).toBe(6);

    // Mode x Difficulty matrix always has 6 cells
    expect(stats.modeDifficultyMatrix).toHaveLength(6);
  });
});
