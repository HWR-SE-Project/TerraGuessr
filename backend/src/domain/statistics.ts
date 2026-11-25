/**
 * Pure player statistics computation (R18/R20).
 *
 * No I/O, no clock reads (`now` is injected), deterministic and unit-testable.
 * All enriched fields (`placeName`, `biome`, `weather`, `temperatureBand`,
 * `attemptsUsed`, `extraDataUnlocked`, `elapsedSeconds`, `matchPlacement`)
 * are optional/nullable so historical rows degrade gracefully.
 */

import type { Difficulty, GameMode } from '@prisma/client';

import { FULL_SCORE_KM, MAX_SCORE } from './scoring.js';

export type StatsPeriod = '7d' | '30d' | '90d' | '6m';
export type StatsModeFilter = 'all' | GameMode;
export type StatsDifficultyFilter = 'all' | Difficulty;
export type AccuracyBand =
  | 'bullseye'
  | 'close'
  | 'regional'
  | 'continent'
  | 'far'
  | 'missed';
export type ConsistencyTier = 'rock_solid' | 'steady' | 'balanced' | 'wildcard';
export type CalloutTone = 'lime' | 'sky' | 'amber' | 'violet';

export interface StatisticsRow {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  matchId: string;
  roundNumber: number;
  guessLat: number | null;
  guessLon: number | null;
  distanceKm: number | null;
  score: number;
  placeName: string | null;
  biome: string | null;
  weather: string | null;
  temperatureBand: string | null;
  attemptsUsed: number | null;
  extraDataUnlocked: boolean | null;
  extraDataPointsSpent: number | null;
  elapsedSeconds: number | null;
  matchPlacement: number | null;
  matchPlayerCount: number | null;
  createdAt: Date;
}

export interface ComputeStatisticsOptions {
  period: StatsPeriod;
  mode: StatsModeFilter;
  difficulty: StatsDifficultyFilter;
  now?: Date;
}

export interface CategoryBreakdownItem {
  key: string;
  rounds: number;
  averageScore: number;
  medianDistanceKm: number | null;
  perfectRate: number;
}

export interface ExplorerCallout {
  id: string;
  title: string;
  detail: string;
  tone: CalloutTone;
}

export interface PlayerStatistics {
  period: StatsPeriod;
  mode: StatsModeFilter;
  difficulty: StatsDifficultyFilter;
  windowStart: string;
  windowEnd: string;
  hasPreviousPeriod: boolean;
  totalRetainedRounds: number;
  kpis: {
    roundsPlayed: number;
    matchesPlayed: number;
    averageScore: number | null;
    medianDistanceKm: number | null;
    averageDistanceKm: number | null;
    perfectCount: number;
    perfectRate: number | null;
    timeoutCount: number;
    timeoutRate: number | null;
    deltas: {
      roundsPlayed: number | null;
      matchesPlayed: number | null;
      averageScore: number | null;
      medianDistanceKm: number | null;
      averageDistanceKm: number | null;
      perfectRate: number | null;
      timeoutRate: number | null;
    };
  };
  personalBests: {
    bestRound: {
      score: number;
      distanceKm: number | null;
      placeName: string | null;
      mode: GameMode;
      difficulty: Difficulty;
      createdAt: string;
    } | null;
    bestMatch: {
      matchId: string;
      totalScore: number;
      averageScore: number;
      rounds: number;
      mode: GameMode;
      difficulty: Difficulty;
      playedAt: string;
    } | null;
  };
  multiplayer: {
    finishedMatches: number;
    wins: number;
    podiums: number;
    winRate: number | null;
    podiumRate: number | null;
    averagePlacement: number | null;
  };
  trend: {
    granularity: 'day' | 'week';
    points: Array<{
      bucketStart: string;
      rounds: number;
      averageScore: number;
      rollingAverageScore: number;
      medianDistanceKm: number | null;
    }>;
  };
  accuracyDistribution: Array<{
    band: AccuracyBand;
    count: number;
    percentage: number;
  }>;
  modeDifficultyMatrix: Array<{
    mode: GameMode;
    difficulty: Difficulty;
    rounds: number;
    matches: number;
    averageScore: number | null;
    medianDistanceKm: number | null;
    perfectRate: number | null;
  }>;
  consistency: {
    currentPerfectStreak: number;
    bestPerfectStreak: number;
    currentPlayStreakDays: number;
    bestPlayStreakDays: number;
    scoreStdDev: number | null;
    scoreIqr: number | null;
    tier: ConsistencyTier | null;
  };
  explorerProfile: ExplorerCallout[];
  environment: {
    sampleSize: number;
    byBiome: CategoryBreakdownItem[];
    byWeather: CategoryBreakdownItem[];
    byTemperatureBand: CategoryBreakdownItem[];
  };
  strategy: {
    elapsedSampleSize: number;
    averageElapsedSeconds: number | null;
    attemptsSampleSize: number;
    averageAttemptsUsed: number | null;
    hintsSampleSize: number;
    hints: {
      unlockedRounds: number;
      notUnlockedRounds: number;
      usageRate: number | null;
      unlockedAvgScore: number | null;
      notUnlockedAvgScore: number | null;
      unlockedMedianDistanceKm: number | null;
      notUnlockedMedianDistanceKm: number | null;
      totalPointsSpent: number;
    };
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<StatsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 183,
};

const MODES: readonly GameMode[] = ['solo', 'multiplayer'];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const ACCURACY_BANDS: readonly AccuracyBand[] = [
  'bullseye',
  'close',
  'regional',
  'continent',
  'far',
  'missed',
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isPerfectRound(row: Pick<StatisticsRow, 'score' | 'distanceKm'>): boolean {
  if (row.score >= MAX_SCORE) return true;
  if (row.distanceKm !== null && Math.round(row.distanceKm * 10) / 10 <= FULL_SCORE_KM) {
    return true;
  }
  return false;
}

function isTimedOutNoGuess(row: Pick<StatisticsRow, 'guessLat' | 'guessLon'>): boolean {
  return row.guessLat === null || row.guessLon === null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

function deltaOf(current: number | null, previous: number | null, precision: 'int' | 'dec1'): number | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  return precision === 'int' ? Math.round(diff) : round1(diff);
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcWeekStartKey(date: Date): string {
  // ISO week starting Monday (UTC)
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - offset);
  return copy.toISOString().slice(0, 10);
}

function classifyAccuracyBand(row: StatisticsRow): AccuracyBand {
  if (isTimedOutNoGuess(row) || row.distanceKm === null) return 'missed';
  const km = Math.round(row.distanceKm * 10) / 10;
  if (km <= FULL_SCORE_KM || row.score >= MAX_SCORE) return 'bullseye';
  if (km < 500) return 'close';
  if (km < 2000) return 'regional';
  if (km < 5000) return 'continent';
  return 'far';
}

function summarizeCore(rows: StatisticsRow[]) {
  const roundsPlayed = rows.length;
  const matchesPlayed = new Set(rows.map((r) => r.matchId)).size;
  const scores = rows.map((r) => r.score);
  const distances = rows
    .map((r) => r.distanceKm)
    .filter((d): d is number => d !== null && Number.isFinite(d));
  const perfectCount = rows.filter(isPerfectRound).length;
  const timeoutCount = rows.filter(isTimedOutNoGuess).length;

  const avgScoreRaw = mean(scores);
  const medDistRaw = median(distances);
  const avgDistRaw = mean(distances);

  return {
    roundsPlayed,
    matchesPlayed,
    averageScore: avgScoreRaw === null ? null : Math.round(avgScoreRaw),
    medianDistanceKm: medDistRaw === null ? null : round1(medDistRaw),
    averageDistanceKm: avgDistRaw === null ? null : round1(avgDistRaw),
    perfectCount,
    perfectRate: roundsPlayed === 0 ? null : round1((perfectCount / roundsPlayed) * 100),
    timeoutCount,
    timeoutRate: roundsPlayed === 0 ? null : round1((timeoutCount / roundsPlayed) * 100),
  };
}

function computeStreaks(
  filteredChronological: StatisticsRow[],
  allRetained: StatisticsRow[],
  now: Date,
) {
  let bestPerfectStreak = 0;
  let runningPerfect = 0;
  for (const row of filteredChronological) {
    if (isPerfectRound(row)) {
      runningPerfect += 1;
      if (runningPerfect > bestPerfectStreak) bestPerfectStreak = runningPerfect;
    } else {
      runningPerfect = 0;
    }
  }
  const currentPerfectStreak = runningPerfect;

  const uniqueDayStrings = Array.from(
    new Set(allRetained.map((r) => utcDayKey(r.createdAt))),
  ).sort();

  const dayEpochs = uniqueDayStrings.map((day) => Date.parse(`${day}T00:00:00.000Z`));
  let bestPlayStreakDays = 0;
  let streak = 0;
  for (let i = 0; i < dayEpochs.length; i++) {
    if (i === 0 || dayEpochs[i]! - dayEpochs[i - 1]! === DAY_MS) {
      streak += 1;
    } else {
      streak = 1;
    }
    if (streak > bestPlayStreakDays) bestPlayStreakDays = streak;
  }

  let currentPlayStreakDays = 0;
  if (dayEpochs.length > 0) {
    const todayEpoch = Date.parse(`${utcDayKey(now)}T00:00:00.000Z`);
    const lastDayEpoch = dayEpochs[dayEpochs.length - 1]!;
    // Active if played today or yesterday (UTC)
    if (todayEpoch - lastDayEpoch <= DAY_MS) {
      currentPlayStreakDays = 1;
      for (let i = dayEpochs.length - 2; i >= 0; i--) {
        if (dayEpochs[i + 1]! - dayEpochs[i]! === DAY_MS) {
          currentPlayStreakDays += 1;
        } else {
          break;
        }
      }
    }
  }

  return {
    currentPerfectStreak,
    bestPerfectStreak,
    currentPlayStreakDays,
    bestPlayStreakDays,
  };
}

function computeConsistencyMetrics(rows: StatisticsRow[]): {
  scoreStdDev: number | null;
  scoreIqr: number | null;
  tier: ConsistencyTier | null;
} {
  if (rows.length < 3) {
    return { scoreStdDev: null, scoreIqr: null, tier: null };
  }
  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const avg = mean(scores)!;
  const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
  const stdDev = Math.round(Math.sqrt(variance));
  const iqr = Math.round(percentile(scores, 0.75) - percentile(scores, 0.25));

  let tier: ConsistencyTier | null = null;
  if (rows.length >= 5) {
    if (stdDev <= 600) tier = 'rock_solid';
    else if (stdDev <= 1050) tier = 'steady';
    else if (stdDev <= 1500) tier = 'balanced';
    else tier = 'wildcard';
  }
  return { scoreStdDev: stdDev, scoreIqr: iqr, tier };
}

function computeCategoryBreakdown(
  rows: StatisticsRow[],
  selector: (row: StatisticsRow) => string | null,
): CategoryBreakdownItem[] {
  const groups = new Map<string, StatisticsRow[]>();
  for (const row of rows) {
    const key = selector(row);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries())
    .map(([key, items]) => {
      const avg = Math.round(mean(items.map((r) => r.score)) ?? 0);
      const dists = items
        .map((r) => r.distanceKm)
        .filter((d): d is number => d !== null && Number.isFinite(d));
      const medDist = median(dists);
      const perfect = items.filter(isPerfectRound).length;
      return {
        key,
        rounds: items.length,
        averageScore: avg,
        medianDistanceKm: medDist === null ? null : round1(medDist),
        perfectRate: round1((perfect / items.length) * 100),
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore || b.rounds - a.rounds);
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildExplorerProfile(input: {
  rows: StatisticsRow[];
  matrix: PlayerStatistics['modeDifficultyMatrix'];
  byBiome: CategoryBreakdownItem[];
  multiplayer: PlayerStatistics['multiplayer'];
  hints: PlayerStatistics['strategy']['hints'];
  consistency: PlayerStatistics['consistency'];
  perfectRate: number | null;
}): ExplorerCallout[] {
  const callouts: ExplorerCallout[] = [];
  if (input.rows.length === 0) return callouts;

  // 1. Strongest mode/difficulty combo (min 3 rounds)
  const eligibleCells = input.matrix.filter((c) => c.rounds >= 3 && c.averageScore !== null);
  if (eligibleCells.length > 0) {
    const bestCell = [...eligibleCells].sort(
      (a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0) || b.rounds - a.rounds,
    )[0]!;
    callouts.push({
      id: 'strongest_mode',
      title: `${formatLabel(bestCell.difficulty)} ${formatLabel(bestCell.mode)} specialist`,
      detail: `${bestCell.averageScore!.toLocaleString('en-US')} avg pts across ${bestCell.rounds} rounds`,
      tone: 'lime',
    });
  }

  // 2. Best biome (if enriched data exists with >= 2 rounds)
  const eligibleBiomes = input.byBiome.filter((b) => b.rounds >= 2);
  if (eligibleBiomes.length >= 2) {
    const topBiome = eligibleBiomes[0]!;
    callouts.push({
      id: 'best_biome',
      title: `${formatLabel(topBiome.key)} navigator`,
      detail: `Best biome at ${topBiome.averageScore.toLocaleString('en-US')} avg pts (${topBiome.rounds} rounds)`,
      tone: 'sky',
    });
  }

  // 3. Multiplayer podium / win prowess
  if (input.multiplayer.finishedMatches >= 2 && input.multiplayer.podiumRate !== null) {
    if (input.multiplayer.wins >= 1 && (input.multiplayer.winRate ?? 0) >= 35) {
      callouts.push({
        id: 'mp_winner',
        title: 'Lobby frontrunner',
        detail: `${input.multiplayer.wins} wins in ${input.multiplayer.finishedMatches} multiplayer matches (${Math.round(input.multiplayer.winRate ?? 0)}%)`,
        tone: 'amber',
      });
    } else if (input.multiplayer.podiumRate >= 50) {
      callouts.push({
        id: 'mp_podium',
        title: 'Podium regular',
        detail: `Top-3 finish in ${Math.round(input.multiplayer.podiumRate)}% of completed lobbies`,
        tone: 'amber',
      });
    }
  }

  // 4. Hints efficiency insight
  if (
    input.hints.unlockedRounds >= 3 &&
    input.hints.notUnlockedRounds >= 3 &&
    input.hints.unlockedAvgScore !== null &&
    input.hints.notUnlockedAvgScore !== null
  ) {
    const diff = input.hints.unlockedAvgScore - input.hints.notUnlockedAvgScore;
    if (diff >= 150) {
      callouts.push({
        id: 'hints_payoff',
        title: 'Clue detective',
        detail: `+${Math.round(diff).toLocaleString('en-US')} avg pts when unlocking extra weather intel`,
        tone: 'violet',
      });
    } else if (diff <= -150) {
      callouts.push({
        id: 'pure_instinct',
        title: 'Pure instinct',
        detail: `+${Math.round(-diff).toLocaleString('en-US')} avg pts without spending on extra intel`,
        tone: 'violet',
      });
    }
  }

  // 5. Sniper / consistency fallback callouts
  if (callouts.length < 3 && (input.perfectRate ?? 0) >= 25 && input.rows.length >= 4) {
    callouts.push({
      id: 'bullseye_sniper',
      title: 'Pinpoint sniper',
      detail: `${Math.round(input.perfectRate!)}% of guesses landed within ${FULL_SCORE_KM} km`,
      tone: 'lime',
    });
  }

  if (callouts.length < 3 && input.consistency.currentPlayStreakDays >= 3) {
    callouts.push({
      id: 'active_streak',
      title: `${input.consistency.currentPlayStreakDays}-day streak`,
      detail: `Best streak: ${input.consistency.bestPlayStreakDays} consecutive days`,
      tone: 'amber',
    });
  }

  return callouts.slice(0, 4);
}

/** Compute window boundaries for a period query (also used by route to bound DB query). */
export function periodWindowBounds(period: StatsPeriod, now: Date) {
  const days = PERIOD_DAYS[period];
  const windowEnd = new Date(now.getTime());
  const windowStart = new Date(now.getTime() - days * DAY_MS);
  const hasPreviousPeriod = period !== '6m';
  const previousStart = hasPreviousPeriod
    ? new Date(windowStart.getTime() - days * DAY_MS)
    : null;
  return { windowStart, windowEnd, hasPreviousPeriod, previousStart };
}

/**
 * Compute full player statistics from the player's retained `GameResult` rows.
 */
export function computePlayerStatistics(
  allRetainedRows: StatisticsRow[],
  options: ComputeStatisticsOptions,
): PlayerStatistics {
  const now = options.now ?? new Date();
  const { windowStart, windowEnd, hasPreviousPeriod, previousStart } =
    periodWindowBounds(options.period, now);

  const matchesFilters = (row: StatisticsRow) =>
    (options.mode === 'all' || row.mode === options.mode) &&
    (options.difficulty === 'all' || row.difficulty === options.difficulty);

  const inPeriodAllModes = allRetainedRows.filter(
    (row) => row.createdAt >= windowStart && row.createdAt <= windowEnd,
  );
  const currentRows = inPeriodAllModes
    .filter(matchesFilters)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.roundNumber - b.roundNumber);

  const previousRows =
    hasPreviousPeriod && previousStart
      ? allRetainedRows.filter(
          (row) =>
            row.createdAt >= previousStart &&
            row.createdAt < windowStart &&
            matchesFilters(row),
        )
      : [];

  const currCore = summarizeCore(currentRows);
  const prevCore = previousRows.length > 0 ? summarizeCore(previousRows) : null;

  // Personal bests within current filtered window
  let bestRound: PlayerStatistics['personalBests']['bestRound'] = null;
  for (const row of currentRows) {
    if (
      !bestRound ||
      row.score > bestRound.score ||
      (row.score === bestRound.score &&
        row.distanceKm !== null &&
        (bestRound.distanceKm === null || row.distanceKm < bestRound.distanceKm))
    ) {
      bestRound = {
        score: row.score,
        distanceKm: row.distanceKm === null ? null : round1(row.distanceKm),
        placeName: row.placeName,
        mode: row.mode,
        difficulty: row.difficulty,
        createdAt: row.createdAt.toISOString(),
      };
    }
  }

  const byMatch = new Map<string, StatisticsRow[]>();
  for (const row of currentRows) {
    const list = byMatch.get(row.matchId);
    if (list) list.push(row);
    else byMatch.set(row.matchId, [row]);
  }

  let bestMatch: PlayerStatistics['personalBests']['bestMatch'] = null;
  for (const [matchId, matchRows] of byMatch) {
    const first = matchRows[0]!;
    const totalScore = matchRows.reduce((sum, r) => sum + r.score, 0);
    const averageScore = Math.round(totalScore / matchRows.length);
    const latestTs = matchRows.reduce(
      (max, r) => (r.createdAt > max ? r.createdAt : max),
      first.createdAt,
    );
    if (
      !bestMatch ||
      totalScore > bestMatch.totalScore ||
      (totalScore === bestMatch.totalScore && averageScore > bestMatch.averageScore)
    ) {
      bestMatch = {
        matchId,
        totalScore,
        averageScore,
        rounds: matchRows.length,
        mode: first.mode,
        difficulty: first.difficulty,
        playedAt: latestTs.toISOString(),
      };
    }
  }

  // Multiplayer completed-match placement summary
  const finishedMpMatches = new Map<string, { placement: number; playerCount: number }>();
  for (const row of currentRows) {
    if (
      row.mode === 'multiplayer' &&
      row.matchPlacement !== null &&
      row.matchPlayerCount !== null &&
      !finishedMpMatches.has(row.matchId)
    ) {
      finishedMpMatches.set(row.matchId, {
        placement: row.matchPlacement,
        playerCount: row.matchPlayerCount,
      });
    }
  }
  const mpEntries = Array.from(finishedMpMatches.values());
  const mpFinishedCount = mpEntries.length;
  const mpWins = mpEntries.filter((e) => e.placement === 1).length;
  const mpPodiums = mpEntries.filter((e) => e.placement <= 3).length;
  const mpAvgPlacement = mean(mpEntries.map((e) => e.placement));
  const multiplayer: PlayerStatistics['multiplayer'] = {
    finishedMatches: mpFinishedCount,
    wins: mpWins,
    podiums: mpPodiums,
    winRate: mpFinishedCount === 0 ? null : round1((mpWins / mpFinishedCount) * 100),
    podiumRate: mpFinishedCount === 0 ? null : round1((mpPodiums / mpFinishedCount) * 100),
    averagePlacement: mpAvgPlacement === null ? null : round1(mpAvgPlacement),
  };

  // Trend series
  const granularity: 'day' | 'week' =
    options.period === '7d' || options.period === '30d' ? 'day' : 'week';
  const bucketMap = new Map<string, StatisticsRow[]>();
  for (const row of currentRows) {
    const key =
      granularity === 'day' ? utcDayKey(row.createdAt) : utcWeekStartKey(row.createdAt);
    const list = bucketMap.get(key);
    if (list) list.push(row);
    else bucketMap.set(key, [row]);
  }
  const sortedBuckets = Array.from(bucketMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rawTrend = sortedBuckets.map(([bucketStart, items]) => {
    const dists = items
      .map((r) => r.distanceKm)
      .filter((d): d is number => d !== null && Number.isFinite(d));
    const medDist = median(dists);
    return {
      bucketStart,
      rounds: items.length,
      averageScore: Math.round(mean(items.map((r) => r.score)) ?? 0),
      medianDistanceKm: medDist === null ? null : round1(medDist),
    };
  });
  const trendPoints = rawTrend.map((point, index) => {
    const start = Math.max(0, index - 2);
    const slice = rawTrend.slice(start, index + 1);
    const rollingAvg = Math.round(
      slice.reduce((sum, item) => sum + item.averageScore, 0) / slice.length,
    );
    return {
      ...point,
      rollingAverageScore: rollingAvg,
    };
  });

  // Accuracy distribution
  const bandCounts = new Map<AccuracyBand, number>(
    ACCURACY_BANDS.map((band) => [band, 0]),
  );
  for (const row of currentRows) {
    const band = classifyAccuracyBand(row);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
  }
  const accuracyDistribution = ACCURACY_BANDS.map((band) => {
    const count = bandCounts.get(band) ?? 0;
    return {
      band,
      count,
      percentage:
        currentRows.length === 0 ? 0 : round1((count / currentRows.length) * 100),
    };
  });

  // Mode × Difficulty matrix (scoped to selected time window so all cells are comparable)
  const modeDifficultyMatrix: PlayerStatistics['modeDifficultyMatrix'] = [];
  for (const mode of MODES) {
    for (const difficulty of DIFFICULTIES) {
      const cellRows = inPeriodAllModes.filter(
        (r) => r.mode === mode && r.difficulty === difficulty,
      );
      const cellSummary = summarizeCore(cellRows);
      modeDifficultyMatrix.push({
        mode,
        difficulty,
        rounds: cellSummary.roundsPlayed,
        matches: cellSummary.matchesPlayed,
        averageScore: cellSummary.averageScore,
        medianDistanceKm: cellSummary.medianDistanceKm,
        perfectRate: cellSummary.perfectRate,
      });
    }
  }

  // Consistency & streaks
  const streaks = computeStreaks(currentRows, allRetainedRows, now);
  const consistencyMetrics = computeConsistencyMetrics(currentRows);
  const consistency: PlayerStatistics['consistency'] = {
    ...streaks,
    ...consistencyMetrics,
  };

  // Environment breakdowns (enriched rows only)
  const envRows = currentRows.filter(
    (r) => r.biome !== null || r.weather !== null || r.temperatureBand !== null,
  );
  const byBiome = computeCategoryBreakdown(currentRows, (r) => r.biome);
  const byWeather = computeCategoryBreakdown(currentRows, (r) => r.weather);
  const byTemperatureBand = computeCategoryBreakdown(
    currentRows,
    (r) => r.temperatureBand,
  );

  // Strategy & hints breakdowns (enriched rows only)
  const elapsedValues = currentRows
    .map((r) => r.elapsedSeconds)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const attemptsValues = currentRows
    .map((r) => r.attemptsUsed)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const hintRows = currentRows.filter((r) => r.extraDataUnlocked !== null);
  const unlockedRows = hintRows.filter((r) => r.extraDataUnlocked === true);
  const notUnlockedRows = hintRows.filter((r) => r.extraDataUnlocked === false);

  const unlockedDists = unlockedRows
    .map((r) => r.distanceKm)
    .filter((d): d is number => d !== null && Number.isFinite(d));
  const notUnlockedDists = notUnlockedRows
    .map((r) => r.distanceKm)
    .filter((d): d is number => d !== null && Number.isFinite(d));
  const totalPointsSpent = hintRows.reduce(
    (sum, r) => sum + (r.extraDataPointsSpent ?? 0),
    0,
  );

  const avgElapsedRaw = mean(elapsedValues);
  const avgAttemptsRaw = mean(attemptsValues);
  const unlockedAvgRaw = mean(unlockedRows.map((r) => r.score));
  const notUnlockedAvgRaw = mean(notUnlockedRows.map((r) => r.score));
  const unlockedMedDistRaw = median(unlockedDists);
  const notUnlockedMedDistRaw = median(notUnlockedDists);

  const strategy: PlayerStatistics['strategy'] = {
    elapsedSampleSize: elapsedValues.length,
    averageElapsedSeconds: avgElapsedRaw === null ? null : Math.round(avgElapsedRaw),
    attemptsSampleSize: attemptsValues.length,
    averageAttemptsUsed: avgAttemptsRaw === null ? null : round1(avgAttemptsRaw),
    hintsSampleSize: hintRows.length,
    hints: {
      unlockedRounds: unlockedRows.length,
      notUnlockedRounds: notUnlockedRows.length,
      usageRate:
        hintRows.length === 0
          ? null
          : round1((unlockedRows.length / hintRows.length) * 100),
      unlockedAvgScore: unlockedAvgRaw === null ? null : Math.round(unlockedAvgRaw),
      notUnlockedAvgScore:
        notUnlockedAvgRaw === null ? null : Math.round(notUnlockedAvgRaw),
      unlockedMedianDistanceKm:
        unlockedMedDistRaw === null ? null : round1(unlockedMedDistRaw),
      notUnlockedMedianDistanceKm:
        notUnlockedMedDistRaw === null ? null : round1(notUnlockedMedDistRaw),
      totalPointsSpent,
    },
  };

  const explorerProfile = buildExplorerProfile({
    rows: currentRows,
    matrix: modeDifficultyMatrix,
    byBiome,
    multiplayer,
    hints: strategy.hints,
    consistency,
    perfectRate: currCore.perfectRate,
  });

  return {
    period: options.period,
    mode: options.mode,
    difficulty: options.difficulty,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    hasPreviousPeriod,
    totalRetainedRounds: allRetainedRows.length,
    kpis: {
      ...currCore,
      deltas: {
        roundsPlayed: prevCore
          ? deltaOf(currCore.roundsPlayed, prevCore.roundsPlayed, 'int')
          : null,
        matchesPlayed: prevCore
          ? deltaOf(currCore.matchesPlayed, prevCore.matchesPlayed, 'int')
          : null,
        averageScore: prevCore
          ? deltaOf(currCore.averageScore, prevCore.averageScore, 'int')
          : null,
        medianDistanceKm: prevCore
          ? deltaOf(currCore.medianDistanceKm, prevCore.medianDistanceKm, 'dec1')
          : null,
        averageDistanceKm: prevCore
          ? deltaOf(currCore.averageDistanceKm, prevCore.averageDistanceKm, 'dec1')
          : null,
        perfectRate: prevCore
          ? deltaOf(currCore.perfectRate, prevCore.perfectRate, 'dec1')
          : null,
        timeoutRate: prevCore
          ? deltaOf(currCore.timeoutRate, prevCore.timeoutRate, 'dec1')
          : null,
      },
    },
    personalBests: {
      bestRound,
      bestMatch,
    },
    multiplayer,
    trend: {
      granularity,
      points: trendPoints,
    },
    accuracyDistribution,
    modeDifficultyMatrix,
    consistency,
    explorerProfile,
    environment: {
      sampleSize: envRows.length,
      byBiome,
      byWeather,
      byTemperatureBand,
    },
    strategy,
  };
}
