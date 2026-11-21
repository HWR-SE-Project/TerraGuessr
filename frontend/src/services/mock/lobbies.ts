// Mock lobby service. Mirrors backend/src/modules/lobbies/routes.ts. A lobby
// is a waiting room plus a live match; bots stand in for other players so the
// leaderboard and round-results flow read naturally. Phase 2 replaces this
// whole layer with real websocket/polling-backed HTTP calls.

import type {
  Candidate,
  Difficulty,
  GeographicIntelligence,
  LatLon,
  Lobby,
  LobbyLeaderboardEntry,
  LobbyMatch,
  LobbyMatchResponse,
  LobbyMatchResult,
  LobbySession,
} from '../../lib/contracts'
import { haversineKm, scoreForDistance } from '../../lib/format'
import { LOCATIONS, locationById, mockWeather, randomLocation } from './data'
import { difficultyInfo, lobbyRules } from '../../lib/difficulty'
import { lobbies, lobbiesByCode } from './db'
import type { MockLobby, MockMatch, MockMatchRound } from './db'

const delay = <T>(value: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

const BOT_NAMES = ['Mira', 'Theo', 'Sora', 'Nico', 'Lena', 'Kai', 'Ravi', 'Yuki']

function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function candidatesFor(answerId: string): Candidate[] {
  // Reuse the location catalogue directly to build easy-mode shortlists.
  const answer = locationById(answerId)
  const distractors = LOCATIONS.filter((loc) => loc.id !== answerId)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
  return [answer, ...distractors]
    .map((loc) => ({ id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon, region: loc.region }))
    .sort(() => Math.random() - 0.5)
}

// --- Lobby/member view mapping ----------------------------------------------

function toLobby(lobby: MockLobby, viewerId: string): Lobby {
  return {
    lobbyId: lobby.lobbyId,
    code: lobby.code,
    difficulty: lobby.difficulty,
    status: lobby.status,
    roundsTotal: lobby.roundsTotal,
    rules: lobbyRules(lobby.difficulty),
    createdAt: lobby.createdAt,
    expiresAt: lobby.expiresAt,
    members: lobby.members.map((member) => ({
      displayName: member.displayName,
      isHost: member.isHost,
      joinedAt: member.joinedAt,
    })),
    youAreHost: lobby.hostId === viewerId,
  }
}

function requireLobby(code: string): MockLobby {
  const id = lobbiesByCode.get(code.toUpperCase())
  const lobby = id ? lobbies.get(id) : undefined
  if (!lobby) {
    throw Object.assign(new Error('This lobby does not exist or has expired.'), {
      code: 'LOBBY_NOT_FOUND',
      status: 404,
    })
  }
  return lobby
}

function requireMember(lobby: MockLobby, token: string): string {
  const member = lobby.members.find((candidate) => lobby.tokens.get(candidate.id) === token)
  if (!member) {
    throw Object.assign(new Error('Lobby membership not found.'), {
      code: 'LOBBY_NOT_FOUND',
      status: 404,
    })
  }
  return member.id
}

function createBotMembers(lobby: MockLobby, count: number) {
  const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5)
  for (let i = 0; i < count; i++) {
    const id = `bot_${Math.random().toString(36).slice(2, 10)}`
    lobby.members.push({
      id,
      displayName: shuffled[i % shuffled.length],
      isHost: false,
      joinedAt: new Date(Date.now() + i * 900).toISOString(),
    })
    lobby.tokens.set(id, `lt_bot_${Math.random().toString(36).slice(2, 16)}`)
  }
}

function buildMatch(lobby: MockLobby): MockMatch {
  const match: MockMatch = {
    status: 'playing',
    currentRound: 1,
    roundsTotal: lobby.roundsTotal,
    startedAt: new Date().toISOString(),
    rounds: new Map(),
    scores: new Map(lobby.members.map((member) => [member.id, 0])),
    results: [],
  }
  const used: string[] = []
  for (let number = 1; number <= lobby.roundsTotal; number++) {
    const location = randomLocation(used)
    used.push(location.id)
    match.rounds.set(number, {
      id: `lr_${Math.random().toString(36).slice(2, 10)}`,
      number,
      locationId: location.id,
      candidates: lobby.difficulty === 'easy' ? candidatesFor(location.id) : [],
      endsAt: new Date(Date.now() + difficultyInfo(lobby.difficulty).timeLimitSeconds * 1000).toISOString(),
      extraDataUnlocked: difficultyInfo(lobby.difficulty).extraData.mode === 'free',
      extraDataPointsSpent: 0,
      guesses: new Map(),
      memberAttempts: new Map(),
      finalized: new Set(),
    })
  }
  return match
}

// Bots finalize a short while after the player does, so the round-result
// screen has a believable "waiting for players" beat before advancing.
function botFinalizeDelay(botIndex: number): number {
  return 2200 + botIndex * 650
}

function ensureBotFinalization(lobby: MockLobby, match: MockMatch, round: MockMatchRound) {
  // Stored transiently on the round object via a side table.
  const finalizedAt = (round as MockMatchRound & { playerFinalizedAt?: number }).playerFinalizedAt
  if (finalizedAt == null) return
  const bots = lobby.members.filter((member) => member.id !== lobby.hostId)
  bots.forEach((bot, index) => {
    if (round.finalized.has(bot.id)) return
    if (Date.now() >= finalizedAt + botFinalizeDelay(index)) {
      finalizeBot(match, round, bot.id)
    }
  })
}

function finalizeBot(match: MockMatch, round: MockMatchRound, memberId: string) {
  const location = locationById(round.locationId)
  // Bots are imperfect guessers: offset from the true location with a random
  // bearing and a distance that produces a believable spread of scores.
  const distanceKm = 40 + Math.random() * 3200
  const bearing = Math.random() * Math.PI * 2
  const dLat = distanceKm / 111
  const dLon = distanceKm / (111 * Math.cos((location.lat * Math.PI) / 180))
  const guess = {
    lat: location.lat + dLat * Math.cos(bearing),
    lon: location.lon + dLon * Math.sin(bearing),
  }
  const actualDistance = haversineKm(guess, { lat: location.lat, lon: location.lon })
  const score = scoreForDistance(actualDistance)
  round.guesses.set(memberId, { ...guess, answer: null })
  round.finalized.add(memberId)
  match.scores.set(memberId, (match.scores.get(memberId) ?? 0) + score)
}

function roundResultView(
  lobby: MockLobby,
  round: MockMatchRound,
  viewerId: string,
): LobbyMatchResult {
  const location = locationById(round.locationId)
  const guesses = lobby.members.map((member) => {
    const guess = round.guesses.get(member.id) ?? null
    const distanceKm = guess ? haversineKm(guess, { lat: location.lat, lon: location.lon }) : null
    const rawScore = distanceKm == null ? 0 : scoreForDistance(distanceKm)
    const spent = member.id === viewerId ? round.extraDataPointsSpent : 0
    return {
      displayName: member.displayName,
      isHost: member.isHost,
      isYou: member.id === viewerId,
      guess: guess ? { lat: guess.lat, lon: guess.lon } : null,
      distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
      score: Math.max(0, rawScore - spent),
      answer: guess?.answer ?? null,
    }
  })
  const you = guesses.find((entry) => entry.isYou)
  return {
    roundNumber: round.number,
    score: you?.score ?? 0,
    distanceKm: you?.distanceKm ?? null,
    guess: you?.guess ?? null,
    actual: { lat: location.lat, lon: location.lon },
    attemptsUsed: 1,
    guesses,
  }
}

function leaderboard(lobby: MockLobby, match: MockMatch, viewerId: string): LobbyLeaderboardEntry[] {
  const sorted = [...lobby.members].sort((a, b) => (match.scores.get(b.id) ?? 0) - (match.scores.get(a.id) ?? 0))
  let rank = 0
  let prevScore: number | null = null
  return sorted.map((member, index) => {
    const score = match.scores.get(member.id) ?? 0
    if (prevScore == null || score !== prevScore) rank = index + 1
    prevScore = score
    return {
      rank,
      displayName: member.displayName,
      isHost: member.isHost,
      isYou: member.id === viewerId,
      totalScore: score,
      roundsCompleted: match.results.length,
    }
  })
}

function matchView(lobby: MockLobby, match: MockMatch, viewerId: string): LobbyMatch {
  let round = match.rounds.get(match.currentRound) ?? null

  if (round) {
    ensureBotFinalization(lobby, match, round)
    const allFinalized = lobby.members.every((member) => round!.finalized.has(member.id))
    if (allFinalized) {
      // Give the round-result screen a beat before advancing.
      if (match.advanceAt == null) match.advanceAt = Date.now() + 1600
      else if (Date.now() >= match.advanceAt) {
        match.advanceAt = undefined
        if (match.currentRound >= match.roundsTotal) {
          match.status = 'finished'
          lobby.status = 'finished'
        } else {
          match.currentRound += 1
          const next = match.rounds.get(match.currentRound)!
          next.endsAt = new Date(Date.now() + difficultyInfo(lobby.difficulty).timeLimitSeconds * 1000).toISOString()
        }
      }
    }
    // Re-read after a potential advance.
    round = match.rounds.get(match.currentRound) ?? null
  }

  const roundComplete = round ? round.finalized.has(viewerId) : false
  const youResult = roundComplete && round ? roundResultView(lobby, round, viewerId) : null

  const pendingPlayers = round
    ? lobby.members.filter((member) => !round.finalized.has(member.id)).map((member) => member.displayName ?? 'Player')
    : []

  const rules = difficultyInfo(lobby.difficulty)
  const extraDataRule = rules.extraData
  const extraDataMode: 'immediate' | 'points' | 'time' =
    extraDataRule.mode === 'free' ? 'immediate' : extraDataRule.mode
  const extraDataCost: number | null = extraDataRule.mode === 'free' ? null : extraDataRule.cost

  return {
    status: match.status,
    currentRound: round ? match.currentRound : null,
    roundsTotal: match.roundsTotal,
    difficulty: lobby.difficulty,
    rules: lobbyRules(lobby.difficulty),
    startedAt: match.startedAt,
    endsAt: null,
    round: round
      ? {
          id: round.id,
          number: round.number,
          panoId: round.locationId,
          candidates: lobby.difficulty === 'easy' ? round.candidates : undefined,
          endsAt: round.endsAt,
          attemptsUsed: round.memberAttempts.get(viewerId) ?? 0,
          attemptsTotal: rules.attemptsPerRound,
          extraData: {
            mode: extraDataMode,
            cost: extraDataCost,
            availableAt: null,
            unlocked: round.extraDataUnlocked,
            pointsSpent: round.extraDataPointsSpent,
          },
        }
      : null,
    roundComplete,
    pendingPlayers,
    you: {
      attemptsUsed: round?.memberAttempts.get(viewerId) ?? 0,
      attemptsTotal: rules.attemptsPerRound,
      selection: round?.guesses.get(viewerId) ? { lat: round.guesses.get(viewerId)!.lat, lon: round.guesses.get(viewerId)!.lon } : null,
      finalized: round ? round.finalized.has(viewerId) : false,
      result: youResult,
    },
    leaderboard: leaderboard(lobby, match, viewerId),
    results: match.results,
  }
}

function responseView(lobby: MockLobby, match: MockMatch, viewerId: string): LobbyMatchResponse {
  return { lobby: toLobby(lobby, viewerId), match: matchView(lobby, match, viewerId) }
}

// --- Public service surface --------------------------------------------------

export const lobbyMock = {
  async create(input: { difficulty: Difficulty; roundsTotal?: number; displayName?: string }): Promise<LobbySession> {
    const code = generateCode()
    const lobby: MockLobby = {
      lobbyId: `lobby_${Math.random().toString(36).slice(2, 10)}`,
      code,
      difficulty: input.difficulty,
      status: 'waiting',
      roundsTotal: input.roundsTotal ?? 5,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      members: [],
      tokens: new Map(),
      hostId: '',
      match: null,
    }
    const hostId = `member_${Math.random().toString(36).slice(2, 10)}`
    const hostToken = `lt_${Math.random().toString(36).slice(2, 16)}`
    lobby.hostId = hostId
    lobby.members.push({
      id: hostId,
      displayName: input.displayName?.trim() || 'You',
      isHost: true,
      joinedAt: new Date().toISOString(),
    })
    lobby.tokens.set(hostId, hostToken)
    createBotMembers(lobby, 3)
    lobbies.set(lobby.lobbyId, lobby)
    lobbiesByCode.set(code, lobby.lobbyId)
    return delay({ lobby: toLobby(lobby, hostId), lobbyToken: hostToken })
  },

  async join(code: string, displayName?: string): Promise<LobbySession> {
    const lobby = requireLobby(code)
    const memberId = `member_${Math.random().toString(36).slice(2, 10)}`
    const token = `lt_${Math.random().toString(36).slice(2, 16)}`
    lobby.members.push({
      id: memberId,
      displayName: displayName?.trim() || 'Player',
      isHost: false,
      joinedAt: new Date().toISOString(),
    })
    lobby.tokens.set(memberId, token)
    return delay({ lobby: toLobby(lobby, memberId), lobbyToken: token })
  },

  async get(code: string, token?: string | null): Promise<Lobby> {
    const lobby = requireLobby(code)
    const viewerId = token ? requireMember(lobby, token) : lobby.hostId
    return delay(toLobby(lobby, viewerId))
  },

  async start(code: string, token: string): Promise<LobbyMatchResponse> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    if (memberId !== lobby.hostId) {
      throw Object.assign(new Error('Only the host can start this match.'), {
        code: 'FORBIDDEN',
        status: 403,
      })
    }
    lobby.match = buildMatch(lobby)
    lobby.status = 'playing'
    return delay(responseView(lobby, lobby.match, memberId), 400)
  },

  async match(code: string, token: string): Promise<LobbyMatchResponse> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    if (!lobby.match) {
      throw Object.assign(new Error('The match has not started yet.'), {
        code: 'NOT_STARTED',
        status: 409,
      })
    }
    return delay(responseView(lobby, lobby.match, memberId), 120)
  },

  async selection(code: string, token: string, point: LatLon): Promise<void> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    const match = lobby.match
    const round = match?.rounds.get(match.currentRound)
    if (round) round.guesses.set(memberId, { lat: point.lat, lon: point.lon, answer: null })
    return delay(undefined, 60)
  },

  async guess(code: string, roundNumber: number, token: string, guess: LatLon, final = false): Promise<{ finalized: boolean; attemptsRemaining: number; result?: LobbyMatchResult }> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    const match = lobby.match!
    const round = match.rounds.get(roundNumber)!

    if (round.finalized.has(memberId)) {
      return delay({ finalized: true, attemptsRemaining: 0, result: roundResultView(lobby, round, memberId) })
    }

    const location = locationById(round.locationId)
    const answer =
      round.candidates.find(
        (candidate) => candidate.lat === guess.lat && candidate.lon === guess.lon,
      )?.name ?? null
    round.guesses.set(memberId, { lat: guess.lat, lon: guess.lon, answer })

    const rules = difficultyInfo(lobby.difficulty)
    const attemptsUsed = (round.memberAttempts.get(memberId) ?? 0) + 1
    round.memberAttempts.set(memberId, attemptsUsed)
    const finalizes = final || attemptsUsed >= rules.attemptsPerRound

    if (finalizes) {
      const distanceKm = haversineKm(guess, { lat: location.lat, lon: location.lon })
      const score = Math.max(0, scoreForDistance(distanceKm) - round.extraDataPointsSpent)
      match.scores.set(memberId, (match.scores.get(memberId) ?? 0) + score)
      round.finalized.add(memberId)
      ;(round as MockMatchRound & { playerFinalizedAt?: number }).playerFinalizedAt = Date.now()
      const result = roundResultView(lobby, round, memberId)
      match.results.push(result)
      return delay({ finalized: true, attemptsRemaining: 0, result }, 400)
    }
    return delay({ finalized: false, attemptsRemaining: rules.attemptsPerRound - attemptsUsed })
  },

  async unlock(code: string, roundNumber: number, token: string): Promise<LobbyMatchResponse> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    const round = lobby.match!.rounds.get(roundNumber)!
    round.extraDataUnlocked = true
    const rules = difficultyInfo(lobby.difficulty)
    if (rules.extraData.mode === 'points') round.extraDataPointsSpent = rules.extraData.cost
    return delay(responseView(lobby, lobby.match!, memberId))
  },

  async finish(code: string, roundNumber: number, token: string): Promise<{ finalized: boolean; attemptsRemaining: number; result?: LobbyMatchResult }> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    const round = lobby.match!.rounds.get(roundNumber)!
    const stored = round.guesses.get(memberId)
    // A player who times out finalizes with their last selection (or none).
    return this.guess(code, roundNumber, token, stored ?? { lat: 0, lon: 0 }, true)
  },

  async continue(code: string, token: string): Promise<LobbyMatchResponse> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    // Rematch: reset the match entirely for a fresh set of rounds.
    lobby.match = buildMatch(lobby)
    lobby.status = 'playing'
    return delay(responseView(lobby, lobby.match, memberId), 400)
  },

  async intelligence(code: string, roundNumber: number, token: string): Promise<GeographicIntelligence> {
    const lobby = requireLobby(code)
    requireMember(lobby, token)
    const round = lobby.match!.rounds.get(roundNumber)!
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

  async leave(code: string, token: string): Promise<void> {
    const lobby = requireLobby(code)
    const memberId = requireMember(lobby, token)
    const index = lobby.members.findIndex((member) => member.id === memberId)
    if (index >= 0) lobby.members.splice(index, 1)
    return delay(undefined)
  },
}
