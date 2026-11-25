import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { hashPlayerToken } from '../../src/plugins/auth.js';
import { createSingleplayerService } from '../../src/modules/singleplayer/service.js';
import { submitLobbyGuess } from '../../src/modules/lobbies/match.js';

const PLAYER_TOKEN = 'player-token';
const PLAYER_HASH = hashPlayerToken(PLAYER_TOKEN);
const FAR_FUTURE = new Date('2100-01-01T00:00:00.000Z');
const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('singleplayer round concurrency guards', () => {
  it('retryRound guards updateMany against concurrent unlock or guess submission and returns 409 on race', async () => {
    const round = {
      id: 'round-1',
      gameId: 'game-1',
      number: 1,
      panoId: 'loc:0',
      targetIndex: 0,
      targetLat: 51.5074,
      targetLon: -0.1278,
      placeName: 'London',
      sceneJson: null,
      candidatesJson: null,
      startedAt: new Date(),
      endsAt: FAR_FUTURE,
      selectionLat: null,
      selectionLon: null,
      additionalDataUnlockedAt: null,
      additionalDataPointsSpent: 0,
      guessLat: null,
      guessLon: null,
      distanceKm: null,
      score: null,
      createdAt: new Date(),
      attempts: [],
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const db = {
      streetGame: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'game-1',
          playerTokenHash: PLAYER_HASH,
          ownerUserId: null,
          difficulty: 'medium',
          expiresAt: FAR_FUTURE,
          nextRoundNumber: null,
          nextTargetIndex: null,
          rounds: [round],
        }),
      },
      streetRound: { updateMany },
    } as unknown as PrismaClient;

    const provider = vi.fn().mockResolvedValue({
      panoId: 'loc:1',
      targetIndex: 1,
      lat: 48.8566,
      lon: 2.3522,
      biome: 'urban',
      placeName: 'Paris',
    });
    const intelligence = vi.fn().mockResolvedValue({
      fetchedAt: new Date().toISOString(),
      cached: false,
      weather: {
        modelTime: new Date().toISOString(),
        temperatureC: 15,
        condition: 'Clear sky',
        windSpeedKmh: 10,
        windDirectionDeg: 180,
        humidityPct: 50,
        pressureHpa: 1012,
        precipitationMm: 0,
        precipitationIntervalMinutes: 15,
      },
      environment: {
        elevationM: null,
        reliefM: null,
        terrain: null,
        biome: null,
        vegetation: null,
      },
      climate: null,
    });

    const service = createSingleplayerService({ db, provider, intelligence });
    await expect(
      service.retryRound('game-1', 'round-1', PLAYER_TOKEN),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'round-1',
          score: null,
          panoId: 'loc:0',
          additionalDataUnlockedAt: null,
          attempts: { none: {} },
        },
      }),
    );
  });

  it('submitGuess locks the round row and checks live endsAt inside $transaction (catches concurrent hard-mode penalty)', async () => {
    const initialRound = {
      id: 'round-1',
      gameId: 'game-1',
      number: 1,
      panoId: 'loc:0',
      targetIndex: 0,
      targetLat: 51.5074,
      targetLon: -0.1278,
      placeName: 'London',
      sceneJson: null,
      candidatesJson: null,
      startedAt: new Date(),
      endsAt: FAR_FUTURE,
      selectionLat: null,
      selectionLon: null,
      additionalDataUnlockedAt: null,
      additionalDataPointsSpent: 0,
      guessLat: null,
      guessLon: null,
      distanceKm: null,
      score: null,
      createdAt: new Date(),
      attempts: [],
    };
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'round-1' }]);
    const createAttempt = vi.fn();
    const tx = {
      $queryRaw: queryRaw,
      streetRound: {
        // Concurrent hard-mode unlock shortened endsAt into the past!
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...initialRound,
          endsAt: PAST,
        }),
      },
      streetRoundAttempt: { create: createAttempt },
    };
    const db = {
      streetGame: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'game-1',
          playerTokenHash: PLAYER_HASH,
          ownerUserId: null,
          difficulty: 'hard',
          expiresAt: FAR_FUTURE,
          rounds: [initialRound],
        }),
      },
      $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaClient;

    const service = createSingleplayerService({ db });
    await expect(
      service.submitGuess('game-1', 'round-1', PLAYER_TOKEN, {
        lat: 51.5,
        lon: -0.12,
        final: true,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'The time limit for this round has expired.',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(createAttempt).not.toHaveBeenCalled();
  });
});

describe('multiplayer guess submission transactional locking', () => {
  it('locks the member row and executes attempt insert, selection update, and finalization in one transaction', async () => {
    const member = {
      id: 'member-1',
      lobbyId: 'lobby-1',
      userId: null,
      playerTokenHash: PLAYER_HASH,
      displayName: 'Host',
      selectionLat: null,
      selectionLon: null,
      continueRequestedAt: null,
      joinedAt: new Date(),
    };
    const round = {
      id: 'round-1',
      lobbyId: 'lobby-1',
      number: 1,
      panoId: 'loc:0',
      targetIndex: 0,
      targetLat: 51.5074,
      targetLon: -0.1278,
      placeName: 'London',
      sceneJson: null,
      candidatesJson: null,
      startedAt: new Date(),
      endsAt: FAR_FUTURE,
      reviewEndsAt: null,
      weatherValidUntil: FAR_FUTURE,
      weatherAttemptedIndices: [0],
      weatherExhausted: false,
      createdAt: new Date(),
      attempts: [],
      results: [],
      memberStates: [],
    };
    const lobby = {
      id: 'lobby-1',
      code: 'ABC234',
      difficulty: 'medium',
      matchId: 'match-1',
      hostTokenHash: PLAYER_HASH,
      roundsTotal: 5,
      status: 'playing',
      currentRound: 1,
      startedAt: new Date(),
      finishedAt: null,
      createdAt: new Date(),
      expiresAt: FAR_FUTURE,
      members: [
        member,
        { ...member, id: 'member-2', playerTokenHash: hashPlayerToken('guest') },
      ],
      rounds: [round],
    };

    const queryRaw = vi.fn().mockResolvedValue([{ id: 'member-1' }]);
    const createAttempt = vi.fn().mockResolvedValue({
      id: 'att-1',
      roundId: 'round-1',
      memberId: 'member-1',
      attemptNumber: 1,
      guessLat: 51.5074,
      guessLon: -0.1278,
      distanceKm: 0,
      score: 5000,
      createdAt: new Date(),
    });
    const updateMember = vi.fn().mockResolvedValue(member);
    const upsertResult = vi.fn().mockResolvedValue({
      id: 'res-1',
      roundId: 'round-1',
      memberId: 'member-1',
      score: 5000,
      attemptsUsed: 1,
      extraDataPointsSpent: 0,
    });
    const tx = {
      $queryRaw: queryRaw,
      lobbyMember: {
        findUnique: vi.fn().mockResolvedValue({ id: 'member-1' }),
        update: updateMember,
      },
      lobbyRound: {
        findUnique: vi.fn().mockResolvedValue(round),
      },
      lobbyRoundAttempt: { create: createAttempt },
      lobbyRoundResult: { upsert: upsertResult },
    };
    const db = {
      lobby: { findUnique: vi.fn().mockResolvedValue(lobby) },
      $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaClient;

    const response = await submitLobbyGuess(
      'ABC234',
      1,
      PLAYER_TOKEN,
      { lat: 51.5074, lon: -0.1278, final: true },
      db,
    );

    expect(response).toEqual({
      finalized: true,
      attemptsRemaining: 0,
      attemptsUsed: 1,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(createAttempt).toHaveBeenCalledTimes(1);
    expect(updateMember).toHaveBeenCalledTimes(1);
    expect(upsertResult).toHaveBeenCalledTimes(1);
  });
});
