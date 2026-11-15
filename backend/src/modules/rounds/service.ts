/**
 * Rounds service (B-06). Starts the next round for a game by integrating the
 * pure selection core (`domain/selection.ts`), the location pool query layer
 * (`modules/locations/service.ts`) and the weather cache
 * (`modules/weather/cache.ts`).
 *
 * The R13 fallback drops a location whose weather cannot be fetched and selects
 * a different one (bounded by MAX_SELECTION_TRIES); if every attempt is
 * exhausted the service fails with 503 SERVICE_UNAVAILABLE.
 */

import type { GameMode, PrismaClient, WeatherSnapshot } from '@prisma/client';

import {
  MAX_SELECTION_TRIES,
  ROUNDS_PER_GAME,
  WEATHER_TTL_MS,
} from '../../config/constants.js';
import { GameNotFoundError } from '../../plugins/auth.js';
import {
  buildCandidates,
  resolveSelectionMode,
  selectRound,
} from '../../domain/selection.js';
import type {
  Difficulty,
  PoolItem,
  Region,
  Rng,
  SelectionMode,
  SelectionResult,
} from '../../domain/selection.js';
import { LocationsService } from '../locations/service.js';
import { getFreshSnapshot, WeatherUnavailableError } from '../weather/cache.js';
import type { WeatherClient } from '../weather/types.js';
import type { RoundView } from '../../contracts/rounds.js';
import { toRoundView } from './dto.js';
import type { RoundCandidate } from './dto.js';
import { prefetchNextRound } from './prefetch.js';

/** 409 CONFLICT thrown by the round state machine (architecture.md §9). */
export class RoundConflictError extends Error {
  public readonly statusCode = 409;

  public constructor(message: string) {
    super(message);
    this.name = 'RoundConflictError';
  }
}

/** 503 SERVICE_UNAVAILABLE thrown when no location has complete weather (R13). */
export class ServiceUnavailableError extends Error {
  public readonly statusCode = 503;

  public constructor() {
    super('No location with complete weather is currently available');
    this.name = 'ServiceUnavailableError';
  }
}

/** A challenge game has exactly one shared round (ADR-0005/ADR-0008). */
export function roundCap(mode: GameMode, roundsTotal = ROUNDS_PER_GAME): number {
  return mode === 'solo' ? roundsTotal : 1;
}

interface LoadedGame {
  mode: GameMode;
  roundsTotal: number;
  attemptsPerRound?: number;
  status: 'active' | 'completed';
  rounds: ReadonlyArray<{ status: 'active' | 'completed' }>;
}

function enforceStateMachine(game: LoadedGame): void {
  if (game.status === 'completed') {
    throw new RoundConflictError('Game is already completed');
  }
  if (game.rounds.some((round) => round.status === 'active')) {
    throw new RoundConflictError('Game already has an active round');
  }
  if (game.rounds.length >= roundCap(game.mode, game.roundsTotal)) {
    throw new RoundConflictError('Game has reached its round limit');
  }
}

interface WeatherSelection {
  snapshot: WeatherSnapshot;
  selection: SelectionResult;
}

/**
 * Pick a location and fetch its weather, dropping any location whose weather
 * cannot be fetched (R13). Bounded to MAX_SELECTION_TRIES selections.
 */
async function selectWithWeatherFallback(
  difficulty: Difficulty,
  region: Region | null,
  candidateCount: number | null,
  requestedMode: SelectionMode | undefined,
  pool: readonly PoolItem[],
  usedIds: ReadonlySet<string>,
  previousActuals: readonly { lat: number; lon: number }[],
  db: PrismaClient,
  weatherClient: WeatherClient,
  rng: Rng,
): Promise<WeatherSelection> {
  const failedIds = new Set<string>();
  let snapshot: WeatherSnapshot | undefined;
  let selection: SelectionResult | undefined;

  for (
    let attempt = 0;
    attempt < MAX_SELECTION_TRIES && snapshot === undefined;
    attempt += 1
  ) {
    const availablePool = pool.filter((item) => !failedIds.has(item.id));

    let picked: SelectionResult | null = null;
    try {
      picked = selectRound({
        difficulty,
        pool: availablePool,
        usedIds,
        previousActuals,
        rng,
        selectionMode: requestedMode,
        ...(region ? { region } : {}),
        ...(candidateCount ? { candidateCount } : {}),
      });
    } catch {
      picked = null;
    }

    if (picked === null) {
      break;
    }
    selection = picked;

    try {
      snapshot = await getFreshSnapshot(db, weatherClient, picked.actual.id);
    } catch (error) {
      if (!(error instanceof WeatherUnavailableError)) {
        throw error;
      }
      failedIds.add(picked.actual.id);
    }
  }

  if (snapshot === undefined || selection === undefined) {
    throw new ServiceUnavailableError();
  }

  return { snapshot, selection };
}

/**
 * Attach nullable location names to a list of selected candidates. Exported
 * so other round-shaped flows (e.g. joining an async challenge, B-10) can
 * build a RoundView through the same path instead of re-deriving names.
 */
export async function resolveCandidateNames(
  candidates: readonly PoolItem[],
  db: PrismaClient,
): Promise<RoundCandidate[]> {
  const ids = candidates.map((candidate) => candidate.id);
  const rows = await db.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });

  const nameById = new Map<string, string | null>(
    rows.map((row): [string, string | null] => [row.id, row.name]),
  );

  return candidates.map((candidate) => ({
    id: candidate.id,
    name: nameById.get(candidate.id) ?? null,
    lat: candidate.lat,
    lon: candidate.lon,
    region: candidate.region,
  }));
}

/** The game fields needed to consume a pending prefetch (R12 / §6a). */
interface PendingPrefetch {
  difficulty: Difficulty;
  candidateCount: number | null;
  nextLocationId: string | null;
  nextWeatherSnapshotId: string | null;
}

/**
 * Fast path: consume the game's pending prefetch when it is still valid.
 * Returns a ready-to-use selection when nextLocationId + the referenced
 * snapshot are present, the snapshot is <= WEATHER_TTL_MS old, and the
 * location is still available (present in the pool and not already used).
 * Otherwise returns null and the caller selects normally.
 */
async function consumePendingPrefetch(
  gameId: string,
  game: PendingPrefetch,
  requestedMode: SelectionMode | undefined,
  pool: readonly PoolItem[],
  usedIds: ReadonlySet<string>,
  db: PrismaClient,
  rng: Rng,
): Promise<WeatherSelection | null> {
  if (!game.nextLocationId || !game.nextWeatherSnapshotId) {
    return null;
  }

  const snapshot = await db.weatherSnapshot.findUnique({
    where: { id: game.nextWeatherSnapshotId },
  });

  const cutoff = new Date(Date.now() - WEATHER_TTL_MS);
  if (
    !snapshot ||
    snapshot.locationId !== game.nextLocationId ||
    snapshot.fetchedAt.getTime() < cutoff.getTime()
  ) {
    return null;
  }

  const actual = pool.find((item) => item.id === game.nextLocationId);
  if (!actual || usedIds.has(actual.id)) {
    return null;
  }

  // Consume the pending prefetch exactly once.
  await db.game.update({
    where: { id: gameId },
    data: { nextLocationId: null, nextWeatherSnapshotId: null },
  });

  const selectionMode = resolveSelectionMode(game.difficulty, requestedMode);
  const candidates =
    selectionMode === 'list'
      ? buildCandidates(game.difficulty, pool, usedIds, actual, rng, game.candidateCount ?? undefined)
      : [];

  return { snapshot, selection: { actual, candidates, selectionMode } };
}

/**
 * Start the next round for 'gameId' and return its client-facing view.
 * Ownership is enforced upstream by the auth hook (ADR-0011).
 */
export async function startRound(
  gameId: string,
  selectionMode: SelectionMode | undefined,
  db: PrismaClient,
  weatherClient: WeatherClient,
  rng: Rng = Math.random,
): Promise<RoundView> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { location: { select: { lat: true, lon: true } } },
      },
    },
  });

  if (!game) {
    throw new GameNotFoundError();
  }

  enforceStateMachine(game);

  const locations = new LocationsService(db);
  const allLocations = await locations.listPool();
  const pool = game.geoRegion ? allLocations.filter((item) => item.region === game.geoRegion) : allLocations;
  const usedIds = new Set(await locations.usedLocationIds(gameId));
  const previousActuals = game.rounds.map((round) => ({
    lat: round.location.lat,
    lon: round.location.lon,
  }));

  // R12 fast path: consume a still-fresh pending prefetch before selecting.
  const prefetched = await consumePendingPrefetch(
    gameId,
    game,
    selectionMode,
    pool,
    usedIds,
    db,
    rng,
  );

  const { snapshot, selection } =
    prefetched ??
    (await selectWithWeatherFallback(
      game.difficulty,
      game.geoRegion,
      game.candidateCount,
      selectionMode,
      pool,
      usedIds,
      previousActuals,
      db,
      weatherClient,
      rng,
    ));

  const roundNumber = game.rounds.length + 1;
  const round = await db.round.create({
    data: {
      gameId,
      locationId: selection.actual.id,
      weatherSnapshotId: snapshot.id,
      roundNumber,
      difficulty: game.difficulty,
      selectionMode: selection.selectionMode,
      status: 'active',
    },
  });

  const candidates =
    selection.selectionMode === 'list'
      ? await resolveCandidateNames(selection.candidates, db)
      : undefined;

  const view = toRoundView({
    round: {
      roundId: round.id,
      roundNumber,
      attemptsTotal: game.attemptsPerRound ?? 1,
      difficulty: game.difficulty,
      selectionMode: selection.selectionMode,
    },
    weather: {
      temperatureC: snapshot.temperatureC,
      precipitationMm: snapshot.precipitationMm,
      humidityPct: snapshot.humidityPct,
      windSpeedKmh: snapshot.windSpeedKmh,
      airPressureHpa: snapshot.airPressureHpa,
      windDirectionDeg: snapshot.windDirectionDeg,
    },
    candidates,
  });

  // Prefetch the next round (R12, best-effort, fire-and-forget) — only when a
  // next round actually exists.
  if (roundNumber < roundCap(game.mode, game.roundsTotal)) {
    void prefetchNextRound(gameId, db, weatherClient, rng);
  }

  return view;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reconstruct the list-mode candidate set for an existing round. The frozen
 * data model does not persist the candidate list, so it is re-derived
 * deterministically (seeded by the round id) with the stored actual forced in
 * and left unflagged (R04).
 */
async function rebuildListCandidates(
  roundId: string,
  difficulty: Difficulty,
  locationId: string,
  region: Region | null,
  candidateCount: number | null,
  usedIds: ReadonlySet<string>,
  db: PrismaClient,
): Promise<RoundCandidate[]> {
  const locations = new LocationsService(db);
  const allLocations = await locations.listPool();
  const pool = region ? allLocations.filter((item) => item.region === region) : allLocations;

  const actual = pool.find((item) => item.id === locationId);
  if (!actual) {
    return [];
  }

  const rng = mulberry32(hashSeed(roundId));
  const candidates = buildCandidates(difficulty, pool, usedIds, actual, rng, candidateCount ?? undefined);

  return resolveCandidateNames(candidates, db);
}

/**
 * Idempotent re-fetch of an existing round's view (GET /api/rounds/:roundId).
 * No selection is re-run; the stored actual is forced into the candidate list.
 */
export async function getRoundView(
  roundId: string,
  db: PrismaClient,
): Promise<RoundView> {
  const round = await db.round.findUnique({
    where: { id: roundId },
    include: {
      weatherSnapshot: true,
      game: {
        include: {
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: { location: { select: { lat: true, lon: true } } },
          },
        },
      },
    },
  });

  if (!round) {
    throw new GameNotFoundError();
  }

  const selectionMode = round.selectionMode as SelectionMode;
  const priorRounds = round.game.rounds.filter(
    (prior) => prior.roundNumber < round.roundNumber,
  );
  const usedIds = new Set(priorRounds.map((prior) => prior.locationId));

  const candidates =
    selectionMode === 'list'
      ? await rebuildListCandidates(
          round.id,
          round.difficulty,
          round.locationId,
          round.game.geoRegion,
          round.game.candidateCount,
          usedIds,
          db,
        )
      : undefined;

  return toRoundView({
    round: {
      roundId: round.id,
      roundNumber: round.roundNumber,
      attemptsTotal: round.game.attemptsPerRound,
      difficulty: round.difficulty,
      selectionMode,
    },
    weather: {
      temperatureC: round.weatherSnapshot.temperatureC,
      precipitationMm: round.weatherSnapshot.precipitationMm,
      humidityPct: round.weatherSnapshot.humidityPct,
      windSpeedKmh: round.weatherSnapshot.windSpeedKmh,
      airPressureHpa: round.weatherSnapshot.airPressureHpa,
      windDirectionDeg: round.weatherSnapshot.windDirectionDeg,
    },
    candidates,
  });
}
