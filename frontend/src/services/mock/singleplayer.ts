// Mock singleplayer service. Mirrors backend/src/modules/singleplayer/routes.ts.
// Rounds are generated locally from the location catalogue; scoring matches the
// real backend curve (see lib/format.ts). Phase 2 replaces this with HTTP calls.

import type {
  AdditionalDataAccess,
  Candidate,
  Difficulty,
  GeographicIntelligence,
  LatLon,
  StreetCredentials,
  StreetGuessResponse,
  StreetResult,
  StreetRound,
  StreetSession,
} from '../../lib/contracts'
import { haversineKm, scoreForDistance } from '../../lib/format'
import { LOCATIONS, locationById, mockWeather, randomLocation } from './data'
import { difficultyInfo } from '../../lib/difficulty'
import { games } from './db'
import type { MockGame, MockRound, MockStreetResult } from './db'

const delay = <T>(value: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

function makeCandidates(answerId: string): Candidate[] {
  const answer = locationById(answerId)
  const distractors = LOCATIONS.filter((loc) => loc.id !== answerId)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
  const pool = [answer, ...distractors].sort(() => Math.random() - 0.5)
  return pool.map((loc) => ({
    id: loc.id,
    name: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    region: loc.region,
  }))
}

function toRound(game: MockGame, round: MockRound): StreetRound {
  const rules = difficultyInfo(game.difficulty)
  const extraData: AdditionalDataAccess =
    rules.extraData.mode === 'free'
      ? { mode: 'immediate', cost: null, availableAt: null, unlocked: true, pointsSpent: 0 }
      : rules.extraData.mode === 'points'
        ? {
            mode: 'points',
            cost: rules.extraData.cost,
            availableAt: null,
            unlocked: round.extraDataUnlocked,
            pointsSpent: round.extraDataPointsSpent,
          }
        : {
            mode: 'time',
            cost: rules.extraData.cost,
            availableAt: round.endsAt,
            unlocked: round.extraDataUnlocked,
            pointsSpent: 0,
          }
  return {
    id: round.id,
    number: round.number,
    panoId: round.locationId,
    candidates: rules.selectionMode === 'list' ? round.candidates : undefined,
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    attemptsUsed: round.attemptsUsed,
    attemptsTotal: round.attemptsTotal,
    extraData,
  }
}

function toResult(result: MockStreetResult): StreetResult {
  return {
    roundId: result.roundId,
    number: result.number,
    guess: result.guess,
    actual: result.actual,
    distanceKm: result.distanceKm,
    score: result.score,
    extraDataPointsSpent: result.extraDataPointsSpent,
  }
}

function requireGame(id: string): MockGame {
  const game = games.get(id)
  if (!game) throw Object.assign(new Error('This game is no longer available.'), { code: 'NOT_FOUND', status: 404 })
  return game
}

function requireRound(game: MockGame, roundId: string): MockRound {
  const round = game.activeRound
  if (!round || round.id !== roundId) {
    throw Object.assign(new Error('This round is not active.'), { code: 'NOT_FOUND', status: 404 })
  }
  return round
}

function endRoundAt(difficulty: Difficulty): string {
  const seconds = difficultyInfo(difficulty).timeLimitSeconds
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export const singleplayerMock = {
  async config(): Promise<{ available: boolean; provider: 'google'; serverKeyConfigured: boolean }> {
    return delay({ available: true, provider: 'google', serverKeyConfigured: true })
  },

  async create(difficulty: Difficulty = 'medium'): Promise<StreetCredentials> {
    const id = `game_${Math.random().toString(36).slice(2, 10)}`
    const game: MockGame = {
      id,
      playerToken: `pt_${Math.random().toString(36).slice(2, 16)}`,
      difficulty,
      totalScore: 0,
      activeRound: null,
      results: [],
      roundsPlayed: 0,
      locationHistory: [],
    }
    games.set(id, game)
    return delay({ id, playerToken: game.playerToken })
  },

  async session(credentials: StreetCredentials): Promise<StreetSession> {
    const game = requireGame(credentials.id)
    return delay({
      id: game.id,
      difficulty: game.difficulty,
      totalScore: game.totalScore,
      activeRound: game.activeRound ? toRound(game, game.activeRound) : null,
      results: game.results.map(toResult),
    })
  },

  async next(credentials: StreetCredentials): Promise<StreetRound> {
    const game = requireGame(credentials.id)
    if (game.activeRound) return delay(toRound(game, game.activeRound))
    const location = randomLocation(game.locationHistory)
    game.locationHistory.push(location.id)
    game.roundsPlayed += 1
    const rules = difficultyInfo(game.difficulty)
    const round: MockRound = {
      id: `round_${Math.random().toString(36).slice(2, 10)}`,
      number: game.roundsPlayed,
      locationId: location.id,
      candidates: rules.selectionMode === 'list' ? makeCandidates(location.id) : [],
      startedAt: new Date().toISOString(),
      endsAt: endRoundAt(game.difficulty),
      attemptsUsed: 0,
      attemptsTotal: rules.attemptsPerRound,
      extraDataUnlocked: rules.extraData.mode === 'free',
      extraDataPointsSpent: 0,
      guess: null,
      result: null,
    }
    game.activeRound = round
    return delay(toRound(game, round))
  },

  async intelligence(credentials: StreetCredentials, roundId: string, _signal?: AbortSignal): Promise<GeographicIntelligence> {
    const game = requireGame(credentials.id)
    const round = requireRound(game, roundId)
    const location = locationById(round.locationId)
    return delay({
      fetchedAt: new Date().toISOString(),
      cached: false,
      weather: mockWeather(location),
      environment: {
        elevationM: location.elevationM,
        reliefM: location.relief === 'High relief' ? 120 : location.relief === 'Rolling relief' ? 45 : 12,
        terrain: location.relief,
        biome: null,
        vegetation: null,
      },
      climate: null,
    })
  },

  async selection(credentials: StreetCredentials, roundId: string, point: LatLon): Promise<void> {
    const game = requireGame(credentials.id)
    const round = requireRound(game, roundId)
    round.guess = { lat: point.lat, lon: point.lon }
    return delay(undefined, 80)
  },

  async unlock(credentials: StreetCredentials, roundId: string): Promise<StreetRound> {
    const game = requireGame(credentials.id)
    const round = requireRound(game, roundId)
    round.extraDataUnlocked = true
    const rules = difficultyInfo(game.difficulty)
    if (rules.extraData.mode === 'points') {
      round.extraDataPointsSpent = rules.extraData.cost
    } else if (rules.extraData.mode === 'time') {
      round.endsAt = new Date(
        Math.max(Date.now(), new Date(round.endsAt!).getTime() - rules.extraData.cost * 1000),
      ).toISOString()
    }
    return delay(toRound(game, round))
  },

  async retry(credentials: StreetCredentials, roundId: string): Promise<StreetRound> {
    const game = requireGame(credentials.id)
    const round = requireRound(game, roundId)
    round.attemptsUsed = 0
    round.guess = null
    round.result = null
    round.endsAt = endRoundAt(game.difficulty)
    round.extraDataUnlocked = difficultyInfo(game.difficulty).extraData.mode === 'free'
    round.extraDataPointsSpent = 0
    return delay(toRound(game, round))
  },

  async guess(credentials: StreetCredentials, roundId: string, guess: LatLon, final = false): Promise<StreetGuessResponse> {
    const game = requireGame(credentials.id)
    const round = requireRound(game, roundId)
    if (round.result) return delay({ finalized: true, attemptsRemaining: 0, result: toResult(round.result) })

    round.attemptsUsed += 1
    const rules = difficultyInfo(game.difficulty)
    const finalizes = final || round.attemptsUsed >= round.attemptsTotal

    if (finalizes) {
      const actual = locationById(round.locationId)
      const distanceKm = haversineKm(guess, { lat: actual.lat, lon: actual.lon })
      const rawScore = scoreForDistance(distanceKm)
      const score = Math.max(0, rawScore - round.extraDataPointsSpent)
      const result: MockStreetResult = {
        roundId: round.id,
        number: round.number,
        guess: { lat: guess.lat, lon: guess.lon },
        actual: { lat: actual.lat, lon: actual.lon },
        distanceKm: Math.round(distanceKm * 10) / 10,
        score,
        extraDataPointsSpent: round.extraDataPointsSpent,
      }
      round.result = result
      game.results.push(result)
      game.totalScore += score
      game.activeRound = null
      return delay({
        finalized: true,
        attemptsRemaining: 0,
        result: toResult(result),
      })
    }

    return delay({
      finalized: false,
      attemptsRemaining: rules.attemptsPerRound - round.attemptsUsed,
    })
  },

  async end(credentials: StreetCredentials): Promise<void> {
    const game = games.get(credentials.id)
    if (!game) return delay(undefined)
    games.delete(credentials.id)
    return delay(undefined)
  },
}
